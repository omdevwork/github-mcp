import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { execSync } from "child_process";
import { existsSync } from "fs";
import { join } from "path";

const server = new McpServer({
  name: "GitHub Push Server",
  version: "1.0.0"
});

function runCommand(command, cwd) {
  try {
    const stdout = execSync(command, { cwd, encoding: "utf8" });
    return { stdout, stderr: "", error: null };
  } catch (error) {
    return { stdout: "", stderr: error.stderr || error.message, error };
  }
}

function gitStatus(cwd) {
  const { stdout, stderr, error } = runCommand("git status --porcelain", cwd);
  if (error) {
    return { hasChanges: false, error: stderr };
  }
  return { hasChanges: !!stdout.trim(), error: null };
}

async function pushToGitHub({ repoDir, commitMessage = "Automated commit from MCP server" }) {
  // Validate repository directory
  if (!existsSync(join(repoDir, ".git"))) {
    return { content: [{ type: "text", text: JSON.stringify({ error: "Specified directory is not a Git repository" }) }] };
  }

  // Check for changes
  const { hasChanges, error } = gitStatus(repoDir);
  if (!hasChanges) {
    if (error) {
      return { content: [{ type: "text", text: JSON.stringify({ error: `Error checking git status: ${error}` }) }] };
    }
    return { content: [{ type: "text", text: JSON.stringify({ message: "No changes to commit" }) }] };
  }

  // Git add
  let result = runCommand("git add .", repoDir);
  if (result.error) {
    return { content: [{ type: "text", text: JSON.stringify({ error: `Error in git add: ${result.stderr}` }) }] };
  }

  // Git commit
  result = runCommand(`git commit -m "${commitMessage}"`, repoDir);
  if (result.error) {
    return { content: [{ type: "text", text: JSON.stringify({ error: `Error in git commit: ${result.stderr}` }) }] };
  }

  // Git push
  result = runCommand("git push origin main", repoDir);
  if (result.error) {
    return { content: [{ type: "text", text: JSON.stringify({ error: `Error in git push: ${result.stderr}` }) }] };
  }

  return { content: [{ type: "text", text: JSON.stringify({ message: "Changes successfully pushed to GitHub!" }) }] };
}

server.tool("pushToGitHub", {
  repoDir: z.string().describe("The full path to the Git repository directory"),
  commitMessage: z.string().optional().describe("Optional commit message for the Git commit")
}, pushToGitHub);

async function init() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

init();