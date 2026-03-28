import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface ProjectType {
  languages: string[];
  frameworks: string[];
  tools: string[];
  testFramework?: string;
  packageManager?: string;
}

export function detectProjectType(dir: string): ProjectType {
  const hasFile = (name: string) => existsSync(join(dir, name));
  const readJson = (name: string) => {
    try {
      return JSON.parse(readFileSync(join(dir, name), "utf-8"));
    } catch {
      return null;
    }
  };

  const type: ProjectType = {
    languages: [],
    frameworks: [],
    tools: [],
  };

  // JavaScript/TypeScript detection
  if (hasFile("package.json")) {
    const pkg = readJson("package.json");

    if (
      hasFile("tsconfig.json") ||
      hasFile("tsconfig.base.json") ||
      pkg?.devDependencies?.typescript
    ) {
      type.languages.push("typescript");
    } else {
      type.languages.push("javascript");
    }

    // Detect frameworks
    if (pkg?.dependencies?.react || pkg?.devDependencies?.react) {
      type.frameworks.push("react");
    }
    if (pkg?.dependencies?.next || pkg?.devDependencies?.next) {
      type.frameworks.push("nextjs");
    }
    if (pkg?.dependencies?.vue || pkg?.devDependencies?.vue) {
      type.frameworks.push("vue");
    }
    if (pkg?.dependencies?.express || pkg?.devDependencies?.express) {
      type.frameworks.push("express");
    }

    // Detect test framework
    if (pkg?.devDependencies?.vitest) {
      type.testFramework = "vitest";
    } else if (pkg?.devDependencies?.jest) {
      type.testFramework = "jest";
    } else if (pkg?.devDependencies?.mocha) {
      type.testFramework = "mocha";
    }

    // Detect package manager
    if (hasFile("pnpm-lock.yaml") || hasFile("pnpm-workspace.yaml")) {
      type.packageManager = "pnpm";
      if (hasFile("pnpm-workspace.yaml")) {
        type.tools.push("pnpm-workspaces");
      }
    } else if (hasFile("yarn.lock")) {
      type.packageManager = "yarn";
    } else if (hasFile("package-lock.json")) {
      type.packageManager = "npm";
    }
  }

  // Python detection
  if (hasFile("pyproject.toml") || hasFile("requirements.txt") || hasFile("setup.py")) {
    type.languages.push("python");

    if (hasFile("pyproject.toml")) {
      type.tools.push("pyproject");
    }

    // Detect Python frameworks (check both files but avoid duplicates)
    const reqFiles = ["requirements.txt", "pyproject.toml"];
    const addFramework = (framework: string) => {
      if (!type.frameworks.includes(framework)) {
        type.frameworks.push(framework);
      }
    };

    for (const file of reqFiles) {
      if (hasFile(file)) {
        const content = readFileSync(join(dir, file), "utf-8").toLowerCase();
        if (content.includes("fastapi")) addFramework("fastapi");
        if (content.includes("django")) addFramework("django");
        if (content.includes("flask")) addFramework("flask");
        if (content.includes("pytest") && !type.testFramework) {
          type.testFramework = "pytest";
        }
      }
    }
  }

  // Go detection
  if (hasFile("go.mod")) {
    type.languages.push("go");
  }

  // Rust detection
  if (hasFile("Cargo.toml")) {
    type.languages.push("rust");
  }

  return type;
}

export function generateRulesFromTemplates(projectType: ProjectType): string {
  const templatesDir = join(__dirname, "../..", "templates", "rules");
  const rules: string[] = [];

  // Always include base rules (if available)
  const basePath = join(templatesDir, "base.md");
  if (existsSync(basePath)) {
    const baseRules = readFileSync(basePath, "utf-8");
    rules.push(baseRules.trim());
  }

  // Add language-specific rules
  for (const lang of projectType.languages) {
    const templatePath = join(templatesDir, `${lang}.md`);
    if (existsSync(templatePath)) {
      const langRules = readFileSync(templatePath, "utf-8");
      rules.push(langRules.trim());
    }
  }

  // Add framework-specific rules
  for (const framework of projectType.frameworks) {
    const templatePath = join(templatesDir, `${framework}.md`);
    if (existsSync(templatePath)) {
      const frameworkRules = readFileSync(templatePath, "utf-8");
      rules.push(frameworkRules.trim());
    }
  }

  // Add tool-specific rules
  for (const tool of projectType.tools) {
    const templatePath = join(templatesDir, `${tool}.md`);
    if (existsSync(templatePath)) {
      const toolRules = readFileSync(templatePath, "utf-8");
      rules.push(toolRules.trim());
    }
  }

  // Add test commands based on detected tools
  const testCommands = generateTestCommands(projectType);
  if (testCommands) {
    rules.push(testCommands);
  }

  return rules.join("\n\n");
}

function generateTestCommands(projectType: ProjectType): string {
  const commands: string[] = [];

  if (
    projectType.languages.includes("typescript") ||
    projectType.languages.includes("javascript")
  ) {
    const pm = projectType.packageManager || "npm";

    commands.push(`Before pushing, run these commands:`);

    if (projectType.tools.includes("pnpm-workspaces")) {
      commands.push(`- ${pm} build (build all packages)`);
      commands.push(`- ${pm} typecheck (type check all packages)`);
      commands.push(`- ${pm} lint (or ${pm} lint:fix to auto-fix)`);
      if (projectType.testFramework) {
        commands.push(`- ${pm} test (run all tests)`);
      }
    } else {
      if (projectType.languages.includes("typescript")) {
        commands.push(`- ${pm} run typecheck`);
      }
      commands.push(`- ${pm} run lint`);
      if (projectType.testFramework) {
        commands.push(`- ${pm} test`);
      }
    }
  } else if (projectType.languages.includes("python")) {
    commands.push(`Before pushing, run these commands:`);
    if (projectType.testFramework === "pytest") {
      commands.push(`- pytest (run tests)`);
    }
    commands.push(`- black . (format code)`);
    commands.push(`- mypy . (type checking)`);
  } else if (projectType.languages.includes("go")) {
    commands.push(`Before pushing, run these commands:`);
    commands.push(`- go test ./... (run tests)`);
    commands.push(`- go vet ./... (check for issues)`);
    commands.push(`- gofmt -w . (format code)`);
  }

  return commands.length > 0 ? commands.join("\n") : "";
}

export function formatProjectTypeForDisplay(projectType: ProjectType): string {
  const parts: string[] = [];

  if (projectType.languages.length > 0) {
    parts.push(`Languages: ${projectType.languages.join(", ")}`);
  }

  if (projectType.frameworks.length > 0) {
    parts.push(`Frameworks: ${projectType.frameworks.join(", ")}`);
  }

  if (projectType.packageManager) {
    parts.push(`Package Manager: ${projectType.packageManager}`);
  }

  if (projectType.testFramework) {
    parts.push(`Test Framework: ${projectType.testFramework}`);
  }

  if (projectType.tools.length > 0) {
    parts.push(`Tools: ${projectType.tools.join(", ")}`);
  }

  return parts.join("\n");
}
