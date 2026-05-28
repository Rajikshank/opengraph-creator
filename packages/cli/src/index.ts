#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, normalize, relative } from "node:path";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  createDefaultProject,
  createMultiPageProject,
  createPageVariantProjects,
  createProjectFromPreset,
  validateStudioDocument,
  getRenderableProject,
  type ExportFormat,
  type Framework,
  type GenerationMode,
  type GenerationStrategy,
  type AgentKind,
  type OgProject,
  type ProjectPreset,
  type SourceArtifactKind
} from "@graphforge/core";
import { exportProject, renderProjectToSvg, type ExportResult } from "@graphforge/render";
import {
  createAiImagePlan,
  type AgentImageOutputFormat
} from "./ai-image.js";
import { createGenerationBrief } from "./brief.js";
import { createImportedSourceDocument, createImportedSourceProject } from "./import-source.js";
import { readStudioDocumentFile, writeStudioDocumentFile } from "./document-io.js";
import { createLibrary, listLibraryProjects, saveLibraryProject } from "./library.js";
import { scanRepo } from "./scan.js";
import { createStudioServer, getDefaultStudioStaticDir } from "./server.js";
import {
  createGraphForgeSession,
  appendSessionEvent,
  cancelGraphForgeSession,
  createPublishRequest,
  getSessionPaths,
  readGraphForgeSession,
  recordSessionExport
} from "./session.js";
import { installCodexSkill } from "./skill-install.js";

export interface CreateProjectArgs {
  name: string;
  strategy: GenerationStrategy;
  generationMode?: GenerationMode;
  repo?: string;
  pages?: string[];
  preset?: ProjectPreset;
}

export interface MetadataPlanInput {
  framework: Framework;
  page: string;
  imagePath: string;
  confirm: boolean;
}

export interface MetadataPlan {
  mode: "preview" | "apply";
  instructions: string[];
  mutations: Array<{ file: string; description: string }>;
}

export interface ExportProjectFileInput {
  projectPath: string;
  format: ExportFormat;
  target: string;
  quality?: number;
}

export interface ExportProjectPagesInput {
  projectPath: string;
  format: ExportFormat;
  outDir: string;
  quality?: number;
}

export interface ExportProjectPagesResult {
  exports: Array<ExportResult & { page: string; path: string }>;
}

export interface ApplyMetadataInput extends MetadataPlanInput {
  repo: string;
}

interface PageImageMapping {
  page: string;
  imagePath: string;
}

export type DoctorCheckStatus = "pass" | "warn" | "fail";

export interface DoctorCheck {
  id: string;
  label: string;
  status: DoctorCheckStatus;
  detail: string;
  action?: string;
}

export interface DoctorReportInput {
  repo?: string;
  home?: string;
  staticDir?: string;
}

export interface DoctorReport {
  ready: boolean;
  checks: DoctorCheck[];
}

type SessionWaitTarget = "default" | "exported" | "publish-preview" | "publish-confirmed" | "agent-request" | "next-action" | "terminal";

export function createProjectFromArgs(args: CreateProjectArgs): OgProject {
  const input = {
    name: args.name,
    strategy: args.strategy,
    generationMode: args.generationMode,
    sourceRepo: args.repo,
    pages: args.pages
  };
  const project = args.preset ? createProjectFromPreset({ ...input, preset: args.preset }) : createDefaultProject(input);
  return project.strategy === "pages" || project.strategy === "hybrid" ? createMultiPageProject(project) : project;
}

export function createMetadataPlan(input: MetadataPlanInput): MetadataPlan {
  const imageUrl = toPublicUrl(input.imagePath);
  const instructions = getFrameworkInstructions(input.framework, input.page, imageUrl);
  const mutations = input.confirm
    ? [
        {
          file: getLikelyMetadataFile(input.framework, input.page),
          description: `Set Open Graph image to ${imageUrl}.`
        }
      ]
    : [];

  return {
    mode: input.confirm ? "apply" : "preview",
    instructions,
    mutations
  };
}

export async function exportProjectFile(input: ExportProjectFileInput): Promise<ExportResult> {
  const project = JSON.parse(await readFile(input.projectPath, "utf8")) as OgProject;
  return exportProject(project, { format: input.format, target: input.target, quality: input.quality });
}

export async function exportProjectPages(input: ExportProjectPagesInput): Promise<ExportProjectPagesResult> {
  const project = JSON.parse(await readFile(input.projectPath, "utf8")) as OgProject;
  const pages = project.pages?.length ? project.pages : [{ route: project.targetPages[0] ?? "/", id: project.activePageId ?? "page-home" }];
  const results: Array<ExportResult & { page: string; path: string }> = [];
  for (const page of pages) {
    const pageProject = getRenderableProject(project, page.id);
    const fileName = `${page.route === "/" ? "home" : page.route.replace(/^\/+/, "").replace(/\/+$/, "").replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase()}.${input.format}`;
    const target = join(input.outDir, fileName);
    const result = await exportProject(pageProject, { format: input.format, target, quality: input.quality });
    results.push({ ...result, path: result.target, page: page.route });
  }
  return { exports: results };
}

export async function applyMetadataPlanToRepo(input: ApplyMetadataInput): Promise<MetadataPlan> {
  const plan = createMetadataPlan(input);
  if (!input.confirm) return plan;

  const imageUrl = toPublicUrl(input.imagePath);
  const file = join(input.repo, getLikelyMetadataFile(input.framework, input.page));
  await writeMetadataFile(file, input.framework, imageUrl);

  return plan;
}

export async function createDoctorReport(input: DoctorReportInput = {}): Promise<DoctorReport> {
  const home = input.home ?? process.env.USERPROFILE ?? process.env.HOME ?? process.cwd();
  const staticDir = input.staticDir ?? getDefaultStudioStaticDir();
  const skillCandidates = [
    join(home, ".codex", "skills", "graphforge-og-studio", "SKILL.md"),
    join(home, ".agents", "skills", "graphforge-og-studio", "SKILL.md")
  ];
  const checks: DoctorCheck[] = [
    {
      id: "cli",
      label: "CLI",
      status: "pass",
      detail: "GraphForge CLI entrypoint is available."
    },
    {
      id: "renderer",
      label: "Renderer",
      status: renderProjectToSvg(createDefaultProject({ name: "Doctor", strategy: "common" })).includes("<svg") ? "pass" : "fail",
      detail: "Renderer can create an SVG preview from the project schema."
    },
    (await pathExists(join(staticDir, "index.html")))
      ? {
          id: "studio-build",
          label: "Studio build",
          status: "pass",
          detail: `Built studio assets found at ${staticDir}.`
        }
      : {
          id: "studio-build",
          label: "Studio build",
          status: "warn",
          detail: `Built studio assets were not found at ${staticDir}.`,
          action: "Run npm run build before launching the packaged studio."
        },
    (await hasBundledSkillSource())
      ? {
          id: "codex-skill-source",
          label: "Bundled agent skill",
          status: "pass",
          detail: "Bundled GraphForge skill source is available."
        }
      : {
          id: "codex-skill-source",
          label: "Bundled agent skill",
          status: "fail",
          detail: "Bundled GraphForge skill source is missing from the CLI package.",
          action: "Rebuild and repack @graphforge/cli."
        },
    (await anyPathExists(skillCandidates))
      ? {
          id: "codex-skill-installed",
          label: "Installed Codex skill",
          status: "pass",
          detail: "GraphForge skill is installed in a known local skills directory."
        }
      : {
          id: "codex-skill-installed",
          label: "Installed Codex skill",
          status: "warn",
          detail: "GraphForge skill is not installed in ~/.codex/skills or ~/.agents/skills.",
          action: "Run graphforge install-skill --target ~/.codex/skills."
        },
    {
      id: "agent-handoff",
      label: "Agent handoff",
      status: "pass",
      detail: "Pure-image generation is delegated to Codex, Claude, or OpenCode handoff plans; no provider key is required."
    }
  ];

  return {
    ready: checks.every((check) => check.status === "pass"),
    checks
  };
}

export async function runCli(argv: string[]): Promise<void> {
  const [command, ...rest] = argv;
  if (!command || command === "help" || command === "--help") {
    printHelp();
    return;
  }

  if (command === "session") {
    const [subcommand, ...sessionRest] = rest;
    const args = parseArgs(sessionRest);
    const repo = args.repo ?? process.cwd();
    if (subcommand === "create") {
      const session = await createGraphForgeSession({
        repo,
        id: args.id,
        agent: parseAgentKind(args.agent),
        strategy: parseStrategy(args.strategy),
        mode: parseGenerationMode(args.mode)
      });
      console.log(JSON.stringify({ session, paths: getSessionPaths(repo, session.id) }, null, 2));
      return;
    }
    if (subcommand === "status") {
      if (!args.id) throw new Error("--id is required");
      console.log(JSON.stringify(await readGraphForgeSession(repo, args.id), null, 2));
      return;
    }
    if (subcommand === "cancel") {
      if (!args.id) throw new Error("--id is required");
      console.log(JSON.stringify(await cancelGraphForgeSession(repo, args.id, args.reason ?? "User cancelled the Studio handoff"), null, 2));
      return;
    }
    if (subcommand === "wait") {
      if (!args.id) throw new Error("--id is required");
      const waitTarget = parseSessionWaitTarget(args.until);
      const timeout = parseWaitTimeout(args.timeout);
      const deadline = Number.isFinite(timeout) ? Date.now() + timeout : Number.POSITIVE_INFINITY;
      let session = await readGraphForgeSession(repo, args.id);
      while (Date.now() < deadline && !sessionMatchesWaitTarget(session, waitTarget)) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        session = await readGraphForgeSession(repo, args.id);
      }
      console.log(JSON.stringify(session, null, 2));
      return;
    }
    if (subcommand === "open") {
      if (!args.id) throw new Error("--id is required");
      await readGraphForgeSession(repo, args.id);
      const handle = await createStudioServer({
        library: createLibrary({ root: args.home }),
        port: args.port ? Number(args.port) : 0,
        sessionRepo: repo
      });
      const params = new URLSearchParams({ session: args.id, repo });
      console.log(`GraphForge Studio running at ${handle.url}?${params.toString()}`);
      console.log("Press Ctrl+C to stop.");
      await new Promise<void>(() => undefined);
      return;
    }
    if (subcommand === "launch") {
      if (!args.id) throw new Error("--id is required");
      await readGraphForgeSession(repo, args.id);
      const port = args.port ? Number(args.port) : await findFreePort();
      const params = new URLSearchParams({ session: args.id, repo });
      const url = `http://127.0.0.1:${port}?${params.toString()}`;
      const child = spawn(process.execPath, [
        fileURLToPath(import.meta.url),
        "session",
        "open",
        "--repo",
        repo,
        "--id",
        args.id,
        "--port",
        String(port)
      ], {
        detached: true,
        stdio: "ignore",
        windowsHide: true
      });
      child.unref();
      if (args.waitReady !== "false") await waitForStudioReady(url, args.id, repo);
      if (args.open !== "false") await openUrl(url);
      const launch = {
        sessionId: args.id,
        repo,
        url,
        pid: child.pid,
        openedAt: new Date().toISOString()
      };
      await writeFile(join(getSessionPaths(repo, args.id).sessionDir, "studio.json"), `${JSON.stringify(launch, null, 2)}\n`, "utf8");
      await appendSessionEvent(repo, args.id, {
        type: "studio.opened",
        message: "Studio launched and ready",
        data: launch
      });
      console.log(args.json === "true" ? JSON.stringify(launch, null, 2) : `GraphForge Studio launched at ${url}`);
      return;
    }
    throw new Error("Unknown session command. Use create, open, launch, wait, cancel, or status.");
  }

  if (command === "document") {
    const [subcommand, ...documentRest] = rest;
    const args = parseArgs(documentRest);
    if (subcommand === "new") {
      const project = createProjectFromArgs({
        name: args.name ?? "Untitled OG Document",
        strategy: parseStrategy(args.strategy),
        generationMode: parseGenerationMode(args.mode),
        repo: args.repo,
        pages: args.pages?.split(",").map((page) => page.trim()),
        preset: parsePreset(args.preset)
      });
      const target = args.out ?? `${project.projectId}.ogdoc`;
      await writeStudioDocumentFile(target, project);
      console.log(`Created ${target}`);
      return;
    }
    if (subcommand === "pack") {
      if (!args.project) throw new Error("--project is required");
      const project = JSON.parse(await readFile(args.project, "utf8")) as OgProject;
      const target = args.out ?? `${project.projectId}.ogdoc`;
      await writeStudioDocumentFile(target, project);
      console.log(`Packed ${target}`);
      return;
    }
    if (subcommand === "unpack") {
      if (!args.source) throw new Error("--source is required");
      const target = args.out ?? "document.json";
      const document = await readStudioDocumentFile(args.source);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, `${JSON.stringify(document.project, null, 2)}\n`, "utf8");
      console.log(`Unpacked ${target}`);
      return;
    }
    if (subcommand === "validate") {
      if (!args.source) throw new Error("--source is required");
      const document = await readStudioDocumentFile(args.source);
      const result = validateStudioDocument(document.project, document.assets);
      console.log(JSON.stringify(result, null, 2));
      if (!result.ok) process.exitCode = 1;
      return;
    }
    throw new Error("Unknown document command. Use new, pack, unpack, or validate.");
  }

  if (command === "new") {
    const args = parseArgs(rest);
    const project = createProjectFromArgs({
      name: args.name ?? "GraphForge OG Project",
      strategy: parseStrategy(args.strategy),
      generationMode: parseGenerationMode(args.mode),
      repo: args.repo,
      pages: args.pages?.split(",").map((page) => page.trim()),
      preset: parsePreset(args.preset)
    });
    const target = args.out ?? `${project.projectId}.og.json`;
    await writeFile(target, `${JSON.stringify(project, null, 2)}\n`, "utf8");
    if (args.library === "true") {
      await saveLibraryProject(createLibrary({ root: args.home }), project);
    }
    console.log(`Created ${target}`);
    return;
  }

  if (command === "save") {
    const args = parseArgs(rest);
    if (!args.project) throw new Error("--project is required");
    const project = JSON.parse(await readFile(args.project, "utf8")) as OgProject;
    const saved = await saveLibraryProject(createLibrary({ root: args.home }), project);
    console.log(`Saved ${saved.path}`);
    return;
  }

  if (command === "list") {
    const args = parseArgs(rest);
    const projects = await listLibraryProjects(createLibrary({ root: args.home }));
    console.log(JSON.stringify({ projects }, null, 2));
    return;
  }

  if (command === "scan") {
    const args = parseArgs(rest);
    const result = await scanRepo(args.repo ?? process.cwd());
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command === "brief") {
    const args = parseArgs(rest);
    const brief = await createGenerationBrief({
      repo: args.repo ?? process.cwd(),
      name: args.name ?? "Untitled App",
      strategy: parseStrategy(args.strategy),
      generationMode: parseGenerationMode(args.mode),
      referenceImage: args.reference
    });
    const target = args.out ?? join(args.repo ?? process.cwd(), ".graphforge", "brief.json");
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, `${JSON.stringify(brief, null, 2)}\n`, "utf8");
    console.log(`Created ${target}`);
    return;
  }

  if (command === "import") {
    const args = parseArgs(rest);
    if (!args.source) throw new Error("--source is required");
    if (args.source.toLowerCase().endsWith(".ogdoc")) {
      const document = await readStudioDocumentFile(args.source);
      const target = args.out ?? `${document.project.projectId}.ogdoc`;
      if (target.toLowerCase().endsWith(".ogdoc")) {
        await writeStudioDocumentFile(target, document.project, document.assets, document.previews);
      } else {
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, `${JSON.stringify(document.project, null, 2)}\n`, "utf8");
      }
      console.log(`Imported ${target}`);
      return;
    }
    const kind = parseSourceArtifactKind(args.kind, args.source);
    const now = new Date().toISOString();

    if (kind === "graphforge-json") {
      const importedProject = JSON.parse(await readFile(args.source, "utf8")) as OgProject;
      const target = args.out ?? `${importedProject.projectId}.og.json`;
      await mkdir(dirname(target), { recursive: true });
      if (target.toLowerCase().endsWith(".ogdoc")) {
        await writeStudioDocumentFile(target, importedProject);
      } else {
        await writeFile(target, `${JSON.stringify(importedProject, null, 2)}\n`, "utf8");
      }
      console.log(`Imported ${target}`);
      return;
    }

    if ((args.out ?? "").toLowerCase().endsWith(".ogdoc")) {
      const document = await createImportedSourceDocument({
        name: args.name ?? "Imported OG Asset",
        source: args.source,
        kind,
        origin: args.origin === "claude" || args.origin === "manual" || args.origin === "library" ? args.origin : "codex",
        createdAt: now
      });
      const target = args.out ?? "imported.ogdoc";
      await writeStudioDocumentFile(target, document.project, document.assets);
      console.log(`Imported ${target}`);
      return;
    }

    const project = await createImportedSourceProject({
      name: args.name ?? "Imported OG Asset",
      source: args.source,
      kind,
      origin: args.origin === "claude" || args.origin === "manual" || args.origin === "library" ? args.origin : "codex",
      createdAt: now
    });
    const target = args.out ?? `${project.projectId}.og.json`;
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, `${JSON.stringify(project, null, 2)}\n`, "utf8");
    if (args.library === "true") {
      await saveLibraryProject(createLibrary({ root: args.home }), project);
    }
    console.log(`Imported ${target}`);
    return;
  }

  if (command === "install-skill") {
    const args = parseArgs(rest);
    const result = await installCodexSkill({
      targetSkillsDir: args.target,
      agent: parseInstallAgent(args.agent),
      home: args.home
    });
    console.log(`Installed GraphForge skill at ${result.skillFile}`);
    if (result.installs.length > 1) {
      console.log(JSON.stringify({ installs: result.installs }, null, 2));
    }
    return;
  }

  if (command === "render") {
    const args = parseArgs(rest);
    const project = args.project
      ? (JSON.parse(await readFile(args.project, "utf8")) as OgProject)
      : createProjectFromArgs({
          name: args.name ?? "Rendered OG",
          strategy: parseStrategy(args.strategy),
          generationMode: parseGenerationMode(args.mode),
          repo: args.repo,
          pages: args.pages?.split(",").map((page) => page.trim()),
          preset: parsePreset(args.preset)
    });
    const svg = renderProjectToSvg(project);
    const target = args.out ?? "og.svg";
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, svg, "utf8");
    console.log(`Rendered ${target}`);
    return;
  }

  if (command === "export") {
    const args = parseArgs(rest);
    if (!args.project) throw new Error("--project is required");
    if (args.allPages === "true" || args.allpages === "true") {
      const outDir = args.outDir ?? args.out ?? "public/og";
      const result = await exportProjectPages({
        projectPath: args.project,
        format: parseFormat(args.format),
        outDir: args.repo && !isAbsolute(outDir) ? join(args.repo, outDir) : outDir,
        quality: args.quality ? Number(args.quality) : undefined
      });
      if (args.session) {
        for (const item of result.exports) {
          await recordSessionExport(args.repo ?? process.cwd(), args.session, {
            path: args.repo ? toRepoRelativePath(args.repo, item.target) : item.target,
            format: item.format,
            width: item.width,
            height: item.height,
            page: item.page,
            fileSizeBytes: item.fileSizeBytes,
            createdAt: new Date().toISOString()
          });
        }
      }
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    const result = await exportProjectFile({
      projectPath: args.project,
      format: parseFormat(args.format),
      target: args.out ?? `og.${args.format ?? "png"}`,
      quality: args.quality ? Number(args.quality) : undefined
    });
    if (args.session) {
      await recordSessionExport(args.repo ?? process.cwd(), args.session, {
        path: result.target,
        format: result.format,
        width: result.width,
        height: result.height,
        fileSizeBytes: result.fileSizeBytes,
        createdAt: new Date().toISOString()
      });
    }
    console.log(`Exported ${result.target} (${result.width}x${result.height}, ${result.fileSizeBytes} bytes)`);
    return;
  }

  if (command === "variants") {
    const args = parseArgs(rest);
    if (!args.project) throw new Error("--project is required");
    const outDir = args.outDir ?? process.cwd();
    const project = JSON.parse(await readFile(args.project, "utf8")) as OgProject;
    const variants = createPageVariantProjects(project);
    await mkdir(outDir, { recursive: true });
    for (const variant of variants) {
      await writeFile(join(outDir, `${variant.projectId}.og.json`), `${JSON.stringify(variant, null, 2)}\n`, "utf8");
      if (args.library === "true") {
        await saveLibraryProject(createLibrary({ root: args.home }), variant);
      }
    }
    console.log(`Created ${variants.length} page variant project${variants.length === 1 ? "" : "s"}`);
    return;
  }

  if (command === "agent-handoff" || command === "agent-image" || command === "ai-image") {
    const args = parseArgs(rest);
    const project = args.project ? (JSON.parse(await readFile(args.project, "utf8")) as OgProject) : undefined;
    const brief = args.brief ? (JSON.parse(await readFile(args.brief, "utf8")) as { codexPrompt?: string }) : undefined;
    const out = args.out ?? "public/og-agent.png";
    const plan = createAiImagePlan({
      project,
      briefPrompt: brief?.codexPrompt,
      extraPrompt: args.prompt,
      out,
      referenceImage: args.reference,
      format: parseAgentImageOutputFormat(args.format, out)
    });
    const target = args.plan ?? `${out}.agent-plan.json`;
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, `${JSON.stringify(plan, null, 2)}\n`, "utf8");
    console.log(`Created agent image handoff ${target}`);
    return;
  }

  if (command === "library-export") {
    const args = parseArgs(rest);
    if (!args.projectId) throw new Error("--projectId is required");
    const { exportLibraryProject } = await import("./library.js");
    const result = await exportLibraryProject(createLibrary({ root: args.home }), {
      projectId: args.projectId,
      format: parseFormat(args.format),
      target: args.out ?? `og.${args.format ?? "png"}`,
      quality: args.quality ? Number(args.quality) : undefined
    });
    console.log(`Exported ${result.target} (${result.width}x${result.height}, ${result.fileSizeBytes} bytes)`);
    return;
  }

  if (command === "apply") {
    const args = parseArgs(rest);
    const plan = await applyMetadataPlanToRepo({
      repo: args.repo ?? process.cwd(),
      framework: parseFramework(args.framework),
      page: args.page ?? "/",
      imagePath: args.image ?? "public/og.png",
      confirm: args.confirm === "true"
    });
    console.log(JSON.stringify(plan, null, 2));
    return;
  }

  if (command === "publish") {
    const args = parseArgs(rest);
    const repo = args.repo ?? process.cwd();
    const sessionId = args.session ?? "manual";
    if (!(await sessionExists(repo, sessionId))) {
      await createGraphForgeSession({
        repo,
        id: sessionId,
        agent: parseAgentKind(args.agent),
        strategy: parseStrategy(args.strategy),
        mode: parseGenerationMode(args.mode)
      });
    }
    const pageImages = await resolvePageImagesForPublish(repo, sessionId, args);
    const imagePath = pageImages?.[0]?.imagePath ?? args.image ?? "public/og.png";
    const framework = parseFramework(args.framework);
    const page = args.page ?? pageImages?.[0]?.page ?? "/";
    const confirmed = args.confirm === "true";
    const request = await createPublishRequest({
      repo,
      sessionId,
      imagePath,
      framework,
      page,
      pageImages,
      confirmed
    });
    const plan = pageImages?.length
      ? await applyPageImageMetadataPlans({ repo, framework, pageImages, confirm: confirmed })
      : await applyMetadataPlanToRepo({
          repo,
          framework,
          page,
          imagePath,
          confirm: confirmed
        });
    console.log(JSON.stringify({ request, plan }, null, 2));
    return;
  }

  if (command === "doctor") {
    const args = parseArgs(rest);
    const report = await createDoctorReport({
      repo: args.repo ?? process.cwd(),
      home: args.home
    });
    if (args.json === "true") {
      console.log(JSON.stringify(report, null, 2));
    } else {
      printDoctorReport(report);
    }
    return;
  }

  if (command === "studio") {
    const args = parseArgs(rest);
    const repo = args.repo;
    const handle = await createStudioServer({
      library: createLibrary({ root: args.home }),
      port: args.port ? Number(args.port) : 0,
      sessionRepo: repo
    });
    const url = repo ? `${handle.url}?${new URLSearchParams({ repo }).toString()}` : handle.url;
    console.log(`GraphForge Studio running at ${url}`);
    console.log("Press Ctrl+C to stop.");
    await new Promise<void>(() => undefined);
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

function parseArgs(args: string[]): Record<string, string> {
  const parsed: Record<string, string> = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg.startsWith("--")) {
      parsed[arg.slice(2)] = args[index + 1] && !args[index + 1].startsWith("--") ? args[++index] : "true";
    }
  }
  return parsed;
}

async function resolvePageImagesForPublish(repo: string, sessionId: string, args: Record<string, string>): Promise<PageImageMapping[] | undefined> {
  if (args.pageImages) {
    const source = args.pageImages.startsWith("@") ? await readFile(args.pageImages.slice(1), "utf8") : args.pageImages;
    const parsed = JSON.parse(source) as PageImageMapping[];
    return parsed.map((item) => ({ page: item.page, imagePath: item.imagePath }));
  }
  if (args.allPages !== "true" && args.allpages !== "true") return undefined;
  const session = await readGraphForgeSession(repo, sessionId);
  const latestByPage = new Map<string, PageImageMapping>();
  for (const item of session.exports) {
    if (item.page) latestByPage.set(item.page, { page: item.page, imagePath: item.path });
  }
  if (latestByPage.size) return [...latestByPage.values()];
  return [...session.publishRequests].reverse().find((request) => request.pageImages?.length)?.pageImages;
}

async function applyPageImageMetadataPlans(input: {
  repo: string;
  framework: Framework;
  pageImages: PageImageMapping[];
  confirm: boolean;
}): Promise<{ mode: "preview" | "apply"; instructions: string[]; mutations: MetadataPlan["mutations"] }> {
  const plans = await Promise.all(
    input.pageImages.map((item) =>
      applyMetadataPlanToRepo({
        repo: input.repo,
        framework: input.framework,
        page: item.page,
        imagePath: item.imagePath,
        confirm: input.confirm
      })
    )
  );
  return {
    mode: input.confirm ? "apply" : "preview",
    instructions: plans.flatMap((plan) => plan.instructions),
    mutations: plans.flatMap((plan) => plan.mutations)
  };
}

function parseSessionWaitTarget(value?: string): SessionWaitTarget {
  if (!value) return "default";
  if (
    value === "exported" ||
    value === "publish-preview" ||
    value === "publish-confirmed" ||
    value === "agent-request" ||
    value === "next-action" ||
    value === "terminal"
  ) {
    return value;
  }
  throw new Error("--until must be one of exported, publish-preview, publish-confirmed, agent-request, next-action, terminal");
}

function parseWaitTimeout(value?: string): number {
  if (!value) return 0;
  if (value === "never" || value === "0") return Number.POSITIVE_INFINITY;
  const timeout = Number(value);
  if (!Number.isFinite(timeout) || timeout < 0) throw new Error("--timeout must be a positive number, 0, or never");
  return timeout;
}

function sessionMatchesWaitTarget(session: Awaited<ReturnType<typeof readGraphForgeSession>>, target: SessionWaitTarget): boolean {
  const hasExport = session.exports.length > 0;
  const hasPreview = session.publishRequests.some((request) => request.status === "preview");
  const hasConfirmed = session.publishRequests.some((request) => request.status === "confirmed");
  const hasAgentRequest = (session.agentRequests ?? []).some((request) => request.status === "requested");

  if (target === "exported") return hasExport;
  if (target === "publish-preview") return hasPreview;
  if (target === "publish-confirmed") return hasConfirmed;
  if (target === "agent-request") return hasAgentRequest;
  if (target === "next-action") {
    return (
      hasAgentRequest ||
      hasConfirmed ||
      session.status === "agent-requested" ||
      session.status === "published" ||
      session.status === "cancelled" ||
      session.status === "terminal"
    );
  }
  if (target === "terminal") return hasConfirmed || session.status === "published" || session.status === "cancelled" || session.status === "terminal";
  return hasExport || hasPreview || hasConfirmed || hasAgentRequest;
}

function parseStrategy(value?: string): GenerationStrategy {
  return value === "pages" || value === "hybrid" ? value : "common";
}

function parseFormat(value?: string): ExportFormat {
  if (value === "webp" || value === "svg" || value === "jpg") return value;
  if (value === "jpeg") return "jpg";
  return "png";
}

function parseAgentKind(value?: string): AgentKind {
  if (value === "codex" || value === "claude" || value === "opencode" || value === "manual") return value;
  return "unknown";
}

function parseInstallAgent(value?: string): "codex" | "claude" | "opencode" | "all" | undefined {
  if (value === "codex" || value === "claude" || value === "opencode" || value === "all") return value;
  return undefined;
}

function parseFramework(value?: string): Framework {
  if (value === "next" || value === "astro" || value === "nuxt" || value === "remix" || value === "vite" || value === "html") {
    return value;
  }
  return "unknown";
}

function parsePreset(value?: string): ProjectPreset | undefined {
  if (
    value === "founder-launch" ||
    value === "product-shot" ||
    value === "technical-article" ||
    value === "studio-editorial" ||
    value === "agent-canvas" ||
    value === "release-notes"
  ) {
    return value;
  }
  return undefined;
}

function parseSourceArtifactKind(value: string | undefined, source: string): SourceArtifactKind {
  if (value === "graphforge-json" || value === "svg" || value === "html" || value === "image") return value;
  const normalized = source.toLowerCase();
  if (normalized.endsWith(".og.json") || normalized.endsWith(".json")) return "graphforge-json";
  if (normalized.endsWith(".svg")) return "svg";
  if (normalized.endsWith(".html") || normalized.endsWith(".htm")) return "html";
  return "image";
}

function parseAgentImageOutputFormat(value: string | undefined, out: string): AgentImageOutputFormat {
  if (value === "webp" || value === "jpeg" || value === "svg") return value;
  const normalized = out.toLowerCase();
  if (normalized.endsWith(".webp")) return "webp";
  if (normalized.endsWith(".jpg") || normalized.endsWith(".jpeg")) return "jpeg";
  if (normalized.endsWith(".svg")) return "svg";
  return "png";
}

function parseGenerationMode(value?: string): GenerationMode {
  return value === "pure-image" ? "pure-image" : "template";
}

function printHelp(): void {
  console.log(`GraphForge OG Studio

Commands:
  graphforge new --name <name> --strategy common|pages|hybrid --mode template|pure-image --preset founder-launch|product-shot|technical-article|studio-editorial|agent-canvas|release-notes --out project.og.json
  graphforge save --project project.og.json
  graphforge list
  graphforge scan --repo <path>
  graphforge brief --repo <path> --name <app> --strategy common|pages|hybrid --mode template|pure-image --reference image.png --out .graphforge/brief.json
  graphforge import --source generated.svg --kind svg --name <app> --out project.og.json
  graphforge install-skill --agent codex|claude|opencode|all
  graphforge document new --name <app> --out project.ogdoc
  graphforge document pack --project project.og.json --out project.ogdoc
  graphforge document validate --source project.ogdoc
  graphforge session create --repo <path> --agent codex|claude|opencode --strategy common|pages|hybrid
  graphforge session open --repo <path> --id <session-id>
  graphforge session launch --repo <path> --id <session-id> --open true --waitReady true --json
  graphforge session wait --id <session-id> --until exported|publish-preview|publish-confirmed|agent-request|next-action|terminal --timeout 30000|0|never
  graphforge session cancel --repo <path> --id <session-id> --reason "User cancelled"
  graphforge session status --id <session-id>
  graphforge studio --port 5123 --repo <path>
  graphforge render --name <name> --out og.svg
  graphforge export --project project.og.json --format png|webp|jpg|svg --out public/og.png --session <session-id>
  graphforge export --project project.og.json --format png|webp|jpg|svg --allPages true --outDir public/og --session <session-id>
  graphforge variants --project project.og.json --outDir og-projects
  graphforge agent-handoff --project project.og.json --prompt "art direction" --out public/og-agent.png --plan .graphforge/agent-handoff.json
  graphforge agent-image --project project.og.json --out public/og-agent.png  (compatibility alias)
  graphforge ai-image --project project.og.json --out public/og-agent.png  (compatibility alias)
  graphforge library-export --projectId <id> --format png --out public/og.png
  graphforge apply --framework next --image public/og.png --preview
  graphforge apply --framework next --image public/og.png --confirm
  graphforge publish --preview --session <session-id> --image public/og.png
  graphforge publish --confirm --session <session-id> --image public/og.png
  graphforge publish --preview --session <session-id> --allPages true
  graphforge publish --confirm --session <session-id> --allPages true
  graphforge doctor
`);
}

async function sessionExists(repo: string, sessionId: string): Promise<boolean> {
  try {
    await readGraphForgeSession(repo, sessionId);
    return true;
  } catch {
    return false;
  }
}

function printDoctorReport(report: DoctorReport): void {
  console.log("GraphForge doctor");
  for (const check of report.checks) {
    const marker = check.status === "pass" ? "PASS" : check.status === "warn" ? "WARN" : "FAIL";
    console.log(`- ${marker} ${check.label}: ${check.detail}`);
    if (check.action) console.log(`  Action: ${check.action}`);
  }
}

async function hasBundledSkillSource(): Promise<boolean> {
  const candidates = [
    new URL("../codex-skill/SKILL.md", import.meta.url),
    new URL("../../codex-skill/SKILL.md", import.meta.url)
  ];
  for (const candidate of candidates) {
    if (await pathExists(fileURLToPath(candidate))) return true;
  }
  return false;
}

async function anyPathExists(paths: string[]): Promise<boolean> {
  for (const path of paths) {
    if (await pathExists(path)) return true;
  }
  return false;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
    server.on("error", reject);
  });
}

async function waitForStudioReady(url: string, sessionId: string, repo: string): Promise<void> {
  const deadline = Date.now() + 10_000;
  const params = new URLSearchParams({ id: sessionId, repo });
  const endpoint = `${url.split("?")[0]}/api/session?${params.toString()}`;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(endpoint);
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Studio did not become ready: ${lastError instanceof Error ? lastError.message : "timeout"}`);
}

async function openUrl(url: string): Promise<void> {
  const command = process.platform === "win32" ? "cmd.exe" : process.platform === "darwin" ? "open" : "xdg-open";
  const args = process.platform === "win32" ? ["/d", "/c", "start", "", url] : [url];
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { stdio: "ignore", windowsHide: true });
    child.on("error", reject);
    child.on("close", () => resolve());
  });
}

function getFrameworkInstructions(framework: Framework, page: string, imageUrl: string): string[] {
  if (framework === "next") {
    return [
      `For ${page}, update the route metadata export.`,
      `Set metadata.openGraph.images to [{ url: "${imageUrl}", width: 1200, height: 630 }].`,
      `Set metadata.twitter.images to ["${imageUrl}"].`
    ];
  }
  if (framework === "astro") {
    return [`For ${page}, set og:image to "${imageUrl}" in the page layout/frontmatter.`];
  }
  if (framework === "nuxt") {
    return [`For ${page}, call useSeoMeta({ ogImage: "${imageUrl}", twitterImage: "${imageUrl}" }).`];
  }
  if (framework === "remix") {
    return [`For ${page}, add og:image and twitter:image entries to the route meta export using "${imageUrl}".`];
  }
  return [`Add <meta property="og:image" content="${imageUrl}"> and the matching twitter:image tag.`];
}

function getLikelyMetadataFile(framework: Framework, page: string): string {
  if (framework === "next") return page === "/" ? "app/layout.tsx" : `app${page}/page.tsx`;
  if (framework === "astro") return "src/layouts/Layout.astro";
  if (framework === "nuxt") return "app.vue";
  if (framework === "remix") return "app/root.tsx";
  if (framework === "vite") return "index.html";
  return "index.html";
}

function toPublicUrl(imagePath: string): string {
  return `/${imagePath.replaceAll("\\", "/").replace(/^public\//, "")}`;
}

function toRepoRelativePath(repo: string, target: string): string {
  const relativePath = isAbsolute(target) ? relative(repo, target) : target;
  return relativePath.replaceAll("\\", "/");
}

async function writeMetadataFile(file: string, framework: Framework, imageUrl: string): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  let existing: string | undefined;
  try {
    const info = await stat(file);
    if (info.isFile()) {
      existing = await readFile(file, "utf8");
      await copyFile(file, `${file}.graphforge.bak`);
    }
  } catch {
    // No existing metadata file to back up.
  }
  await writeFile(file, createMetadataFile(framework, imageUrl, existing), "utf8");
}

function createMetadataFile(framework: Framework, imageUrl: string, existing?: string): string {
  if (framework === "next") return existing ? upsertNextMetadataFile(existing, imageUrl) : createNextMetadataFile(imageUrl);
  if (framework === "astro") return existing ? upsertHtmlMetadata(existing, imageUrl) : createAstroMetadataFile(imageUrl);
  if (framework === "nuxt") return existing ? upsertNuxtMetadataFile(existing, imageUrl) : createNuxtMetadataFile(imageUrl);
  if (framework === "remix") return existing ? upsertRemixMetadataFile(existing, imageUrl) : createRemixMetadataFile(imageUrl);
  return upsertHtmlMetadata(existing ?? createHtmlMetadataFile(imageUrl), imageUrl);
}

function createNextMetadataFile(imageUrl: string): string {
  return `import type { Metadata } from "next";

export const metadata: Metadata = {
  openGraph: {
    images: [{ url: "${imageUrl}", width: 1200, height: 630 }]
  },
  twitter: {
    card: "summary_large_image",
    images: ["${imageUrl}"]
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
`;
}

function upsertNextMetadataFile(source: string, imageUrl: string): string {
  const metadataBlock = createNextMetadataObject(imageUrl);
  const workingSource = source.includes('from "next"') ? source : `import type { Metadata } from "next";\n\n${source}`;
  const metadataMatch = /export\s+const\s+metadata(?:\s*:\s*Metadata)?\s*=\s*/.exec(workingSource);

  if (!metadataMatch) {
    return workingSource.replace(/export\s+default\s+function/, `${metadataBlock}\n\nexport default function`);
  }

  const start = metadataMatch.index + metadataMatch[0].length;
  const objectStart = workingSource.indexOf("{", start);
  if (objectStart < 0) return createNextMetadataFile(imageUrl);
  const objectEnd = findMatchingBrace(workingSource, objectStart);
  if (objectEnd < 0) return createNextMetadataFile(imageUrl);

  const existingObject = workingSource.slice(objectStart, objectEnd + 1);
  const mergedObject = mergeNextMetadataObject(existingObject, imageUrl);
  return workingSource.slice(0, objectStart) + mergedObject + workingSource.slice(objectEnd + 1);
}

function createNextMetadataObject(imageUrl: string): string {
  return `export const metadata: Metadata = {
  openGraph: {
    images: [{ url: "${imageUrl}", width: 1200, height: 630 }]
  },
  twitter: {
    card: "summary_large_image",
    images: ["${imageUrl}"]
  }
};`;
}

function mergeNextMetadataObject(existingObject: string, imageUrl: string): string {
  const body = existingObject.slice(1, -1).trim();
  const withoutOpenGraph = removeObjectProperty(body, "openGraph");
  const withoutTwitter = removeObjectProperty(withoutOpenGraph, "twitter").trim().replace(/,+$/, "");
  const preserved = withoutTwitter ? `${withoutTwitter.replace(/\n?$/, "")},\n` : "";
  return `{
  ${preserved}  openGraph: {
    images: [{ url: "${imageUrl}", width: 1200, height: 630 }]
  },
  twitter: {
    card: "summary_large_image",
    images: ["${imageUrl}"]
  }
}`;
}

function removeObjectProperty(source: string, property: string): string {
  const match = new RegExp(`(^|\\n)\\s*${escapeRegExp(property)}\\s*:`).exec(source);
  if (!match) return source;
  const valueStart = (match.index ?? 0) + match[0].length;
  const valueEnd = findPropertyValueEnd(source, valueStart);
  return `${source.slice(0, match.index)}${source.slice(valueEnd)}`;
}

function findPropertyValueEnd(source: string, valueStart: number): number {
  let index = valueStart;
  let depth = 0;
  let quote: string | undefined;

  while (index < source.length) {
    const char = source[index];
    const previous = source[index - 1];
    if (quote) {
      if (char === quote && previous !== "\\") quote = undefined;
    } else if (char === '"' || char === "'" || char === "`") {
      quote = char;
    } else if (char === "{" || char === "[" || char === "(") {
      depth += 1;
    } else if (char === "}" || char === "]" || char === ")") {
      depth -= 1;
    } else if (char === "," && depth <= 0) {
      return index + 1;
    }
    index += 1;
  }

  return source.length;
}

function findMatchingBrace(source: string, openIndex: number): number {
  let depth = 0;
  let quote: string | undefined;

  for (let index = openIndex; index < source.length; index += 1) {
    const char = source[index];
    const previous = source[index - 1];
    if (quote) {
      if (char === quote && previous !== "\\") quote = undefined;
    } else if (char === '"' || char === "'" || char === "`") {
      quote = char;
    } else if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }

  return -1;
}

function createAstroMetadataFile(imageUrl: string): string {
  return `---
const ogImage = "${imageUrl}";
---
<html lang="en">
  <head>
    <meta property="og:image" content={ogImage} />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:image" content={ogImage} />
  </head>
  <body>
    <slot />
  </body>
</html>
`;
}

function createNuxtMetadataFile(imageUrl: string): string {
  return `<script setup lang="ts">
useSeoMeta({
  ogImage: "${imageUrl}",
  twitterCard: "summary_large_image",
  twitterImage: "${imageUrl}"
});
</script>

<template>
  <NuxtPage />
</template>
`;
}

function upsertNuxtMetadataFile(source: string, imageUrl: string): string {
  if (/<script\s+setup[^>]*>/i.test(source)) {
    return upsertNuxtSeoMetaInExistingScript(source, imageUrl);
  }

  return `${createNuxtScriptSetup(imageUrl)}\n\n${source}`;
}

function upsertNuxtSeoMetaInExistingScript(source: string, imageUrl: string): string {
  const scriptClose = /<\/script>/i.exec(source);
  if (!scriptClose) return `${createNuxtScriptSetup(imageUrl)}\n\n${source}`;

  const callMatch = /useSeoMeta\s*\(\s*\{/.exec(source);
  if (!callMatch || callMatch.index > scriptClose.index) {
    return source.replace(/<\/script>/i, `${createNuxtSeoMetaCall(imageUrl)}\n</script>`);
  }

  const objectStart = source.indexOf("{", callMatch.index);
  const objectEnd = findMatchingBrace(source, objectStart);
  if (objectStart < 0 || objectEnd < 0 || objectEnd > scriptClose.index) {
    return source.replace(/<\/script>/i, `${createNuxtSeoMetaCall(imageUrl)}\n</script>`);
  }

  const existingObject = source.slice(objectStart, objectEnd + 1);
  const mergedObject = mergeNuxtSeoMetaObject(existingObject, imageUrl);
  return source.slice(0, objectStart) + mergedObject + source.slice(objectEnd + 1);
}

function createNuxtScriptSetup(imageUrl: string): string {
  return `<script setup lang="ts">
${createNuxtSeoMetaCall(imageUrl)}
</script>`;
}

function createNuxtSeoMetaCall(imageUrl: string): string {
  return `useSeoMeta({
  ogImage: "${imageUrl}",
  twitterCard: "summary_large_image",
  twitterImage: "${imageUrl}"
});`;
}

function mergeNuxtSeoMetaObject(existingObject: string, imageUrl: string): string {
  const body = existingObject.slice(1, -1).trim();
  const withoutOgImage = removeObjectProperty(body, "ogImage");
  const withoutTwitterImage = removeObjectProperty(withoutOgImage, "twitterImage");
  const withoutTwitterCard = removeObjectProperty(withoutTwitterImage, "twitterCard").trim().replace(/,+$/, "");
  const preserved = withoutTwitterCard ? `${withoutTwitterCard.replace(/\n?$/, "")},\n` : "";
  return `{
  ${preserved}  ogImage: "${imageUrl}",
  twitterCard: "summary_large_image",
  twitterImage: "${imageUrl}"
}`;
}

function createRemixMetadataFile(imageUrl: string): string {
  return `import type { MetaFunction } from "@remix-run/node";
import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "@remix-run/react";

export const meta: MetaFunction = () => [
  { property: "og:image", content: "${imageUrl}" },
  { name: "twitter:card", content: "summary_large_image" },
  { name: "twitter:image", content: "${imageUrl}" }
];

export default function App() {
  return (
    <html lang="en">
      <head>
        <Meta />
        <Links />
      </head>
      <body>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
`;
}

function upsertRemixMetadataFile(source: string, imageUrl: string): string {
  const workingSource = source.includes('from "@remix-run/node"')
    ? source
    : `import type { MetaFunction } from "@remix-run/node";\n${source}`;
  const metaMatch = /export\s+const\s+meta\s*:\s*MetaFunction\s*=\s*\(\)\s*=>\s*\[/.exec(workingSource);

  if (!metaMatch) {
    return workingSource.replace(/export\s+default\s+function/, `${createRemixMetaExport(imageUrl)}\n\nexport default function`);
  }

  const arrayStart = workingSource.indexOf("[", metaMatch.index);
  const arrayEnd = findMatchingBracket(workingSource, arrayStart);
  if (arrayStart < 0 || arrayEnd < 0) return createRemixMetadataFile(imageUrl);

  const existingArray = workingSource.slice(arrayStart, arrayEnd + 1);
  const mergedArray = mergeRemixMetaArray(existingArray, imageUrl);
  return workingSource.slice(0, arrayStart) + mergedArray + workingSource.slice(arrayEnd + 1);
}

function createRemixMetaExport(imageUrl: string): string {
  return `export const meta: MetaFunction = () => ${createRemixMetaArray(imageUrl)};`;
}

function createRemixMetaArray(imageUrl: string): string {
  return `[
  { property: "og:image", content: "${imageUrl}" },
  { name: "twitter:card", content: "summary_large_image" },
  { name: "twitter:image", content: "${imageUrl}" }
]`;
}

function mergeRemixMetaArray(existingArray: string, imageUrl: string): string {
  const body = existingArray.slice(1, -1);
  const preserved = body
    .split(/\n/)
    .filter((line) => !/["'](?:og:image|twitter:image|twitter:card)["']/.test(line))
    .join("\n")
    .trim()
    .replace(/,+$/, "");
  const prefix = preserved ? `${preserved},\n` : "";
  return `[
  ${prefix}  { property: "og:image", content: "${imageUrl}" },
  { name: "twitter:card", content: "summary_large_image" },
  { name: "twitter:image", content: "${imageUrl}" }
]`;
}

function findMatchingBracket(source: string, openIndex: number): number {
  let depth = 0;
  let quote: string | undefined;

  for (let index = openIndex; index < source.length; index += 1) {
    const char = source[index];
    const previous = source[index - 1];
    if (quote) {
      if (char === quote && previous !== "\\") quote = undefined;
    } else if (char === '"' || char === "'" || char === "`") {
      quote = char;
    } else if (char === "[") {
      depth += 1;
    } else if (char === "]") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }

  return -1;
}

function createHtmlMetadataFile(imageUrl: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta property="og:image" content="${imageUrl}">
    <meta name="twitter:image" content="${imageUrl}">
  </head>
  <body></body>
</html>
`;
}

function upsertHtmlMetadata(html: string, imageUrl: string): string {
  const withoutOldTwitterCard = removeMetaTag(html, "name", "twitter:card");
  const withOgImage = upsertMetaTag(withoutOldTwitterCard, "property", "og:image", imageUrl);
  const withTwitterImage = upsertMetaTag(withOgImage, "name", "twitter:image", imageUrl);
  return insertMetaTagIfMissing(withTwitterImage, '<meta name="twitter:card" content="summary_large_image">');
}

function upsertMetaTag(html: string, attribute: "name" | "property", key: string, content: string): string {
  const tag = `<meta ${attribute}="${key}" content="${content}">`;
  const pattern = new RegExp(`<meta\\s+[^>]*${attribute}=["']${escapeRegExp(key)}["'][^>]*>`, "i");
  if (pattern.test(html)) {
    return html.replace(pattern, tag);
  }
  return insertMetaTagIfMissing(html, tag);
}

function removeMetaTag(html: string, attribute: "name" | "property", key: string): string {
  const pattern = new RegExp(`\\s*<meta\\s+[^>]*${attribute}=["']${escapeRegExp(key)}["'][^>]*>`, "i");
  return html.replace(pattern, "");
}

function insertMetaTagIfMissing(html: string, tag: string): string {
  if (html.includes(tag)) return html;
  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `    ${tag}\n  </head>`);
  }
  const head = `<head>\n    ${tag}\n  </head>`;
  if (/<html[^>]*>/i.test(html)) {
    return html.replace(/<html[^>]*>/i, (match) => `${match}\n  ${head}`);
  }
  return `<!doctype html>\n<html lang="en">\n  ${head}\n  <body>${html}</body>\n</html>\n`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isCliEntrypoint(argvPath = process.argv[1]): boolean {
  if (!argvPath) return false;
  try {
    const current = normalize(realpathSync(fileURLToPath(import.meta.url))).toLowerCase();
    const invoked = normalize(realpathSync(argvPath)).toLowerCase();
    return current === invoked;
  } catch {
    return import.meta.url === pathToFileURL(argvPath).href;
  }
}

if (isCliEntrypoint()) {
  runCli(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
