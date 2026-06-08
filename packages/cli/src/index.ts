#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { appendFile, copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, normalize, relative } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  createDefaultProject,
  createMultiPageProject,
  createPageVariantProjects,
  createProjectFromPreset,
  sanitizeGeneratedProjectEffects,
  normalizeProjectEffects,
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
} from "@opengraph-creator/core";
import { exportProject, renderProjectToSvg, type ExportResult } from "@opengraph-creator/render";
import {
  createAiImagePlan,
  type AgentImageOutputFormat
} from "./ai-image.js";
import { createBrandStoreFromScan, getBrandStorePaths, recordCompositionHistory } from "./brand-store.js";
import { createGenerationBrief } from "./brief.js";
import { checkRender, lintDesignDocument, lintGenerationBrief, type GenerationControlLintResult } from "./generation-control.js";
import { createImportedSourceDocument, createImportedSourceProject } from "./import-source.js";
import { readStudioDocumentFile, writeStudioDocumentFile } from "./document-io.js";
import { createLibrary, listLibraryProjects, readLibraryProject, saveLibraryProject } from "./library.js";
import { exportProjectToPsd } from "./psd-export.js";
import { scanRepo } from "./scan.js";
import { createStudioServer, getDefaultStudioStaticDir } from "./server.js";
import {
  createOpenGraphCreatorSession,
  appendSessionEvent,
  attachOpenGraphCreatorSession,
  cancelOpenGraphCreatorSession,
  createPublishRequest,
  getSessionPaths,
  readOpenGraphCreatorSession,
  recordSessionExport,
  resolveActiveAgentRequestAfterDocumentReady,
  writeOpenGraphCreatorSession
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

export interface StudioLaunchRecord {
  sessionId: string;
  repo: string;
  url: string;
  pid?: number;
  openedAt: string;
  reused?: boolean;
}

export interface UpdateReportInput {
  home?: string;
  currentRuntimeVersion?: string;
  latestRuntimeVersion?: string;
  bundledSkillVersion?: string;
}

export interface InstalledSkillStatus {
  path: string;
  version?: string;
  status: "fresh" | "stale" | "unknown";
}

export interface UpdateReport {
  runtime: {
    currentVersion: string;
    latestVersion?: string;
    updateAvailable: boolean | "unknown";
    autoUpdateCommand: string;
  };
  skill: {
    bundledVersion?: string;
    installed: InstalledSkillStatus[];
    updateRequired: boolean;
    manualUpdateCommands: string[];
    restartRequired: boolean;
  };
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

export interface SessionDocumentPreflightResult {
  ok: boolean;
  sessionId: string;
  documentPath: string;
  repaired: boolean;
  projectId?: string;
  errors: string[];
  warnings: string[];
  recovery: string[];
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

export async function readReusableStudioLaunch(
  repo: string,
  sessionId: string,
  options: { latestVersion?: string } = {}
): Promise<StudioLaunchRecord | undefined> {
  const launchPath = join(getSessionPaths(repo, sessionId).sessionDir, "studio.json");
  try {
    const launch = JSON.parse(await readFile(launchPath, "utf8")) as StudioLaunchRecord;
    if (launch.sessionId !== sessionId || normalize(launch.repo) !== normalize(repo) || !launch.url) return undefined;
    const alive = await isStudioLaunchAlive(launch, repo, sessionId, options.latestVersion);
    return alive ? { ...launch, reused: true } : undefined;
  } catch {
    return undefined;
  }
}

async function isStudioLaunchAlive(
  launch: StudioLaunchRecord,
  repo: string,
  sessionId: string,
  latestVersion?: string
): Promise<boolean> {
  try {
    const healthUrl = new URL(launch.url);
    healthUrl.pathname = "/api/session";
    healthUrl.search = "";
    healthUrl.searchParams.set("id", sessionId);
    healthUrl.searchParams.set("repo", repo);
    const response = await fetch(healthUrl, { signal: AbortSignal.timeout(900) });
    if (!response.ok) return false;
    const body = await response.json() as { session?: { id?: string; repo?: string } };
    const sameSession = body.session?.id === sessionId && (!body.session.repo || normalize(body.session.repo) === normalize(repo));
    if (!sameSession) return false;
    if (!latestVersion) return true;
    const versionUrl = new URL(launch.url);
    versionUrl.pathname = "/api/version";
    versionUrl.search = "";
    const versionResponse = await fetch(versionUrl, { signal: AbortSignal.timeout(900) });
    if (!versionResponse.ok) return false;
    const version = await versionResponse.json() as { version?: string };
    return Boolean(version.version && compareVersions(version.version, latestVersion) >= 0);
  } catch {
    return false;
  }
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

export async function createUpdateReport(input: UpdateReportInput = {}): Promise<UpdateReport> {
  const home = input.home ?? process.env.USERPROFILE ?? process.env.HOME ?? process.cwd();
  const currentVersion = input.currentRuntimeVersion ?? await readCurrentRuntimeVersion();
  const latestVersion = input.latestRuntimeVersion ?? await fetchLatestRuntimeVersion();
  const bundledSkillVersion = input.bundledSkillVersion ?? await readBundledSkillVersion();
  const installed = await readInstalledSkillStatuses(home, bundledSkillVersion);
  const updateAvailable =
    latestVersion === undefined ? "unknown" : compareVersions(latestVersion, currentVersion) > 0;
  const updateRequired = installed.some((skill) => skill.status !== "fresh") || installed.length === 0;

  return {
    runtime: {
      currentVersion,
      latestVersion,
      updateAvailable,
      autoUpdateCommand: "npx -y opengraph-creator@latest"
    },
    skill: {
      bundledVersion: bundledSkillVersion,
      installed,
      updateRequired,
      manualUpdateCommands: [
        "npx skills check -g opengraph-creator",
        "npx skills add -g Rajikshank/opengraph-creator --skill opengraph-creator --agent \"*\" -y",
        "npx -y opengraph-creator@latest doctor --json"
      ],
      restartRequired: updateRequired
    }
  };
}

export function shouldAutoRefreshRuntime(input: {
  command?: string;
  currentVersion?: string;
  latestVersion?: string;
  env?: Record<string, string | undefined>;
}): boolean {
  if (!input.command || !input.currentVersion || !input.latestVersion) return false;
  if (input.env?.OPENGRAPH_CREATOR_AUTO_UPDATED === "1") return false;
  if (input.env?.OPENGRAPH_CREATOR_DISABLE_AUTO_UPDATE === "1") return false;
  if (input.command === "install-skill" || input.command === "update") return false;
  return compareVersions(input.latestVersion, input.currentVersion) > 0;
}

export async function createDoctorReport(input: DoctorReportInput = {}): Promise<DoctorReport> {
  const home = input.home ?? process.env.USERPROFILE ?? process.env.HOME ?? process.cwd();
  const staticDir = input.staticDir ?? getDefaultStudioStaticDir();
  const update = await createUpdateReport({ home });
  const skillCandidates = getSkillCandidates(home);
  const checks: DoctorCheck[] = [
    {
      id: "cli",
      label: "CLI",
      status: "pass",
      detail: "OpenGraph Creator CLI entrypoint is available."
    },
    {
      id: "runtime-update",
      label: "Runtime update",
      status: update.runtime.updateAvailable === true ? "warn" : "pass",
      detail:
        update.runtime.updateAvailable === true
          ? `A newer Studio runtime is available (${update.runtime.latestVersion}). OpenGraph Creator can relaunch through ${update.runtime.autoUpdateCommand}.`
          : update.runtime.updateAvailable === "unknown"
            ? "Could not check the npm registry for a newer Studio runtime."
            : `Studio runtime is current (${update.runtime.currentVersion}).`,
      action:
        update.runtime.updateAvailable === true
          ? `${update.runtime.autoUpdateCommand} doctor --json`
          : undefined
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
          id: "agent-skill-source",
          label: "Bundled agent skill",
          status: "pass",
          detail: "Bundled OpenGraph Creator skill source is available."
        }
      : {
          id: "agent-skill-source",
          label: "Bundled agent skill",
          status: "fail",
          detail: "Bundled OpenGraph Creator skill source is missing from the CLI package.",
          action: "Rebuild and repack opengraph-creator."
        },
    (await anyPathExists(skillCandidates))
      ? {
          id: "agent-skill-installed",
          label: "Installed agent skill",
          status: update.skill.updateRequired ? "warn" : "pass",
          detail: update.skill.updateRequired
            ? "OpenGraph Creator skill is installed but stale. Update skills, then start a new agent session."
            : "OpenGraph Creator skill is installed in a known local skills directory.",
          action: update.skill.updateRequired ? update.skill.manualUpdateCommands.join(" && ") : undefined
        }
      : {
          id: "agent-skill-installed",
          label: "Installed agent skill",
          status: "warn",
          detail: "OpenGraph Creator skill is not installed in a known Codex, Claude Code, or OpenCode skills directory.",
          action:
            "Preferred: npx skills add -g Rajikshank/opengraph-creator --skill opengraph-creator --agent \"*\" -y. Fallback: opengraph-creator install-skill --agent codex --scope global."
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

  if (command === "update") {
    const [subcommand, ...updateRest] = rest;
    const args = parseArgs(updateRest);
    if (subcommand === "check") {
      const report = await createUpdateReport({ home: args.home });
      console.log(JSON.stringify(report, null, 2));
      if (report.skill.updateRequired) process.exitCode = 1;
      return;
    }
    throw new Error("Unknown update command. Use check.");
  }

  if (command === "session") {
    const [subcommand, ...sessionRest] = rest;
    const args = parseArgs(sessionRest);
    const repo = args.repo ?? process.cwd();
    if (subcommand === "create") {
      const session = await createOpenGraphCreatorSession({
        repo,
        id: args.id,
        agent: parseAgentKind(args.agent),
        strategy: parseStrategy(args.strategy),
        mode: parseGenerationMode(args.mode)
      });
      console.log(JSON.stringify({ session, paths: getSessionPaths(repo, session.id) }, null, 2));
      return;
    }
    if (subcommand === "attach") {
      if (!args.project) throw new Error("--project is required");
      const source = await readAttachProjectSource(args.project, args.home);
      const session = await attachOpenGraphCreatorSession({
        repo,
        id: args.id,
        agent: parseAgentKind(args.agent),
        project: source.project,
        assets: source.assets,
        previews: source.previews,
        source: source.source
      });
      if (args.launch === "true") {
        await runCli([
          "session",
          "launch",
          "--repo",
          repo,
          "--id",
          session.id,
          "--open",
          args.open ?? "true",
          "--waitReady",
          args.waitReady ?? "true",
          "--json",
          args.json ?? "true"
        ]);
      }
      if (args.wait === "true") {
        await runCli([
          "session",
          "wait",
          "--repo",
          repo,
          "--id",
          session.id,
          "--until",
          args.until ?? "next-action",
          "--timeout",
          args.timeout ?? "0"
        ]);
        return;
      }
      console.log(JSON.stringify({ session, paths: getSessionPaths(repo, session.id) }, null, 2));
      return;
    }
    if (subcommand === "status") {
      if (!args.id) throw new Error("--id is required");
      console.log(JSON.stringify(await readOpenGraphCreatorSession(repo, args.id), null, 2));
      return;
    }
    if (subcommand === "validate") {
      if (!args.id) throw new Error("--id is required");
      const result = await preflightSessionDocument(repo, args.id, { repairLegacyProject: args.repair === "true" });
      console.log(JSON.stringify(result, null, 2));
      if (!result.ok) process.exitCode = 1;
      return;
    }
    if (subcommand === "cancel") {
      if (!args.id) throw new Error("--id is required");
      console.log(JSON.stringify(await cancelOpenGraphCreatorSession(repo, args.id, args.reason ?? "User cancelled the Studio handoff"), null, 2));
      return;
    }
    if (subcommand === "wait") {
      if (!args.id) throw new Error("--id is required");
      const waitTarget = parseSessionWaitTarget(args.until);
      const timeout = parseWaitTimeout(args.timeout);
      const deadline = Number.isFinite(timeout) ? Date.now() + timeout : Number.POSITIVE_INFINITY;
      let session = await readOpenGraphCreatorSession(repo, args.id);
      while (Date.now() < deadline && !sessionMatchesWaitTarget(session, waitTarget)) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        session = await readOpenGraphCreatorSession(repo, args.id);
      }
      console.log(JSON.stringify(session, null, 2));
      return;
    }
    if (subcommand === "open") {
      if (!args.id) throw new Error("--id is required");
      await readOpenGraphCreatorSession(repo, args.id);
      const handle = await createStudioServer({
        library: createLibrary({ root: args.home }),
        port: args.port ? Number(args.port) : 0,
        sessionRepo: repo
      });
      const params = new URLSearchParams({ session: args.id, repo });
      console.log(`OpenGraph Creator Studio running at ${handle.url}?${params.toString()}`);
      console.log("Press Ctrl+C to stop.");
      await new Promise<void>(() => undefined);
      return;
    }
    if (subcommand === "launch") {
      if (!args.id) throw new Error("--id is required");
      const preflight = await preflightSessionDocument(repo, args.id, { repairLegacyProject: true });
      if (!preflight.ok) throw new Error(formatSessionDocumentPreflightError(preflight));
      if (args.forceNew !== "true") {
        const update = await createUpdateReport();
        const reusable = await readReusableStudioLaunch(repo, args.id, {
          latestVersion: update.runtime.latestVersion
        });
        if (reusable) {
          await appendSessionEvent(repo, args.id, {
            type: "studio.reused",
            message: "Reused the already-running Studio session",
            data: { ...reusable }
          });
          console.log(args.json === "true" ? JSON.stringify(reusable, null, 2) : `OpenGraph Creator Studio already running at ${reusable.url}`);
          return;
        }
      }
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
      console.log(args.json === "true" ? JSON.stringify(launch, null, 2) : `OpenGraph Creator Studio launched at ${url}`);
      return;
    }
    throw new Error("Unknown session command. Use create, attach, open, launch, wait, cancel, validate, or status.");
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
      name: args.name ?? "OpenGraph OG Project",
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

  if (command === "brand") {
    const [subcommand, ...brandRest] = rest;
    const args = parseArgs(brandRest);
    const repo = args.repo ?? process.cwd();
    if (subcommand === "inspect") {
      const scan = await scanRepo(repo);
      const brand = await createBrandStoreFromScan(scan);
      const paths = getBrandStorePaths(repo);
      const output = { brand, paths };
      console.log(args.json === "true" ? JSON.stringify(output, null, 2) : `Created ${paths.brandJson}`);
      return;
    }
    if (subcommand === "record-composition") {
      if (!args.session) throw new Error("--session is required");
      if (!args.archetype) throw new Error("--archetype is required");
      const history = await recordCompositionHistory(repo, {
        sessionId: args.session,
        archetypeId: args.archetype,
        conceptThesis: args.concept ?? "Recorded composition archetype.",
        createdAt: new Date().toISOString()
      });
      console.log(JSON.stringify(history, null, 2));
      return;
    }
    throw new Error("Unknown brand command. Use inspect or record-composition.");
  }

  if (command === "brief") {
    if (rest[0] === "lint") {
      const args = parseArgs(rest.slice(1));
      if (!args.source) throw new Error("--source is required");
      const brief = JSON.parse(await readFile(args.source, "utf8")) as Record<string, unknown>;
      const result = lintGenerationBrief(brief);
      await writeGenerationControlLog(args, "brief.lint", result);
      console.log(JSON.stringify(result, null, 2));
      if (!result.ok) process.exitCode = 1;
      return;
    }
    const args = parseArgs(rest);
    const brief = await createGenerationBrief({
      repo: args.repo ?? process.cwd(),
      name: args.name ?? "Untitled App",
      strategy: parseStrategy(args.strategy),
      generationMode: parseGenerationMode(args.mode),
      referenceImage: args.reference
    });
    const target = args.out ?? join(args.repo ?? process.cwd(), ".opengraph-creator", "brief.json");
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, `${JSON.stringify(brief, null, 2)}\n`, "utf8");
    console.log(`Created ${target}`);
    return;
  }

  if (command === "assets") {
    const [subcommand, ...assetsRest] = rest;
    const args = parseArgs(assetsRest);
    if (subcommand === "lint") {
      const source = args.brief ?? args.source;
      if (!source) throw new Error("--brief or --source is required");
      const brief = JSON.parse(await readFile(source, "utf8")) as Record<string, unknown>;
      const result = lintGenerationBrief(brief);
      await writeGenerationControlLog(args, "assets.lint", result);
      console.log(JSON.stringify(result, null, 2));
      if (!result.ok) process.exitCode = 1;
      return;
    }
    throw new Error("Unknown assets command. Use lint.");
  }

  if (command === "design") {
    const [subcommand, ...designRest] = rest;
    const args = parseArgs(designRest);
    if (subcommand === "lint") {
      const source = args.source ?? args.project;
      if (!source) throw new Error("--source or --project is required");
      const document = await readProjectDocumentForChecks(source);
      const result = lintDesignDocument(document.project, document.assets);
      await writeGenerationControlLog(args, "design.lint", result);
      console.log(JSON.stringify(result, null, 2));
      if (!result.ok) process.exitCode = 1;
      return;
    }
    throw new Error("Unknown design command. Use lint.");
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

    if (kind === "project-json") {
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
      home: args.home,
      project: args.project ?? args.repo,
      scope: args.scope === "project" ? "project" : "global"
    });
    console.log(`Installed OpenGraph Creator skill at ${result.skillFile}`);
    if (result.installs.length > 1) {
      console.log(JSON.stringify({ installs: result.installs }, null, 2));
    }
    return;
  }

  if (command === "render") {
    if (rest[0] === "check") {
      const args = parseArgs(rest.slice(1));
      const source = args.source ?? args.project;
      if (!source) throw new Error("--source or --project is required");
      const document = await readProjectDocumentForChecks(source);
      const result = checkRender(document.project);
      await writeGenerationControlLog(args, "render.check", result);
      console.log(JSON.stringify(result, null, 2));
      if (!result.ok) process.exitCode = 1;
      return;
    }
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

  if (command === "export-source") {
    const args = parseArgs(rest);
    if (args.format !== "psd") throw new Error("Only --format psd is supported by export-source for now.");
    if (!args.source && !args.project) throw new Error("--source or --project is required");
    const source = args.source ?? args.project;
    if (!source) throw new Error("--source is required");
    const project = await readProjectForSourceExport(source);
    const target = args.out ?? "open-graph.psd";
    const result = await exportProjectToPsd(project, target);
    console.log(JSON.stringify(result, null, 2));
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
      await createOpenGraphCreatorSession({
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
    console.log(`OpenGraph Creator Studio running at ${url}`);
    console.log("Press Ctrl+C to stop.");
    await new Promise<void>(() => undefined);
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

async function readProjectDocumentForChecks(source: string): Promise<{ project: OgProject; assets: Record<string, Uint8Array> }> {
  if (source.toLowerCase().endsWith(".ogdoc")) {
    const document = await readStudioDocumentFile(source);
    return { project: document.project, assets: document.assets };
  }
  return { project: normalizeProjectEffects(JSON.parse(await readFile(source, "utf8")) as OgProject).project, assets: {} };
}

async function writeGenerationControlLog(
  args: Record<string, string>,
  kind: string,
  result: GenerationControlLintResult
): Promise<void> {
  const explicitLog = args.log;
  const sessionId = args.id ?? args.session;
  const repo = args.repo ?? (sessionId ? process.cwd() : undefined);
  const logPath = explicitLog ?? (repo && sessionId ? join(getSessionPaths(repo, sessionId).sessionDir, "generation-errors.jsonl") : undefined);
  if (!logPath) return;
  await mkdir(dirname(logPath), { recursive: true });
  await appendFile(
    logPath,
    `${JSON.stringify({
      at: new Date().toISOString(),
      kind,
      ok: result.ok,
      errors: result.errors,
      warnings: result.warnings,
      recovery: result.recovery
    })}\n`,
    "utf8"
  );
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

async function readAttachProjectSource(
  source: string,
  home?: string
): Promise<{ project: OgProject; assets?: Record<string, Uint8Array>; previews?: Record<string, Uint8Array>; source: string }> {
  const sourcePath = await resolveExistingSourcePath(source);
  if (sourcePath) {
    if (sourcePath.toLowerCase().endsWith(".ogdoc")) {
      const document = await readStudioDocumentFile(sourcePath);
      return {
        project: document.project,
        assets: document.assets,
        previews: document.previews,
        source: sourcePath
      };
    }
    if (sourcePath.toLowerCase().endsWith(".json")) {
      return {
        project: JSON.parse(await readFile(sourcePath, "utf8")) as OgProject,
        source: sourcePath
      };
    }
    throw new Error("--project must be a Studio project id, .ogdoc file, or project JSON file");
  }

  try {
    const project = await readLibraryProject(createLibrary({ root: home }), source);
    return { project, source: `library:${source}` };
  } catch (error) {
    throw new Error(
      `Could not attach project "${source}". Provide a saved Studio project id, .ogdoc path, or project JSON path. ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

async function resolveExistingSourcePath(source: string): Promise<string | undefined> {
  const candidates = isAbsolute(source) ? [source] : [source, join(process.cwd(), source)];
  for (const candidate of candidates) {
    if (await pathExists(candidate)) return candidate;
  }
  return undefined;
}

async function resolvePageImagesForPublish(repo: string, sessionId: string, args: Record<string, string>): Promise<PageImageMapping[] | undefined> {
  if (args.pageImages) {
    const source = args.pageImages.startsWith("@") ? await readFile(args.pageImages.slice(1), "utf8") : args.pageImages;
    const parsed = JSON.parse(source) as PageImageMapping[];
    return parsed.map((item) => ({ page: item.page, imagePath: item.imagePath }));
  }
  if (args.allPages !== "true" && args.allpages !== "true") return undefined;
  const session = await readOpenGraphCreatorSession(repo, sessionId);
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

export async function preflightSessionDocument(
  repo: string,
  sessionId: string,
  options: { repairLegacyProject?: boolean } = {}
): Promise<SessionDocumentPreflightResult> {
  const session = await readOpenGraphCreatorSession(repo, sessionId);
  const paths = getSessionPaths(repo, sessionId);
  const warnings = await getSessionHealthWarnings(repo, sessionId, session);
  const recovery = [
    `Create a valid editable Studio document at ${paths.documentFile}.`,
    `Validate it with opengraph-creator document validate --source "${paths.documentFile}".`,
    `Then relaunch with opengraph-creator session launch --repo "${repo}" --id "${sessionId}" --open true --waitReady true --json.`
  ];

  if (await pathExists(paths.documentFile)) {
    try {
      const document = await readStudioDocumentFile(paths.documentFile);
      const effectPolicy = await readGeneratedEffectsPolicy(paths.generationBriefJson);
      const sanitized = sanitizeGeneratedProjectEffects(document.project, effectPolicy);
      const project = sanitized.project;
      const nextWarnings = [...warnings, ...sanitized.warnings];
      const validation = validateStudioDocument(project, document.assets);
      if (!validation.ok) {
        return {
          ok: false,
          sessionId,
          documentPath: paths.documentFile,
          repaired: false,
          projectId: project.projectId,
          errors: validation.errors,
          warnings: nextWarnings,
          recovery
        };
      }
      if (sanitized.changed && options.repairLegacyProject) {
        await writeStudioDocumentFile(paths.documentFile, project, document.assets, document.previews);
        await appendSessionEvent(repo, sessionId, {
          type: "document.sanitized",
          message: "Sanitized generated document effects before Studio launch",
          data: { documentPath: paths.documentFile, warnings: sanitized.warnings }
        });
        await markSessionEditingAfterDocumentPreflight(repo, session, paths.documentFile, project.projectId);
        return {
          ok: true,
          sessionId,
          documentPath: paths.documentFile,
          repaired: true,
          projectId: project.projectId,
          errors: [],
          warnings: nextWarnings,
          recovery: []
        };
      }
      if (options.repairLegacyProject) {
        await markSessionEditingAfterDocumentPreflight(repo, session, paths.documentFile, project.projectId);
      }
      return {
        ok: true,
        sessionId,
        documentPath: paths.documentFile,
        repaired: false,
        projectId: project.projectId,
        errors: [],
        warnings: nextWarnings,
        recovery: []
      };
    } catch (error) {
      return {
        ok: false,
        sessionId,
        documentPath: paths.documentFile,
        repaired: false,
        errors: [`Invalid Studio document package: ${error instanceof Error ? error.message : String(error)}`],
        warnings,
        recovery
      };
    }
  }

  if (await pathExists(paths.projectJson)) {
    const packCommand = `opengraph-creator document pack --project "${paths.projectJson}" --out "${paths.documentFile}"`;
    if (!options.repairLegacyProject) {
      return {
        ok: false,
        sessionId,
        documentPath: paths.documentFile,
        repaired: false,
        errors: [`Session document is missing: ${paths.documentFile}. Legacy project JSON exists at ${paths.projectJson}.`],
        warnings,
        recovery: [packCommand, ...recovery]
      };
    }
    try {
      const project = JSON.parse(await readFile(paths.projectJson, "utf8")) as OgProject;
      const effectPolicy = await readGeneratedEffectsPolicy(paths.generationBriefJson);
      const sanitized = sanitizeGeneratedProjectEffects(project, effectPolicy);
      await writeStudioDocumentFile(paths.documentFile, sanitized.project);
      await writeOpenGraphCreatorSession({
        ...session,
        status: "editing",
        activeProjectId: sanitized.project.projectId,
        activeDocumentPath: paths.documentFile,
        pendingAction: "studio-editing",
        lastHeartbeatAt: new Date().toISOString()
      }, repo);
      await appendSessionEvent(repo, sessionId, {
        type: "document.recovered",
        message: "Packed legacy project JSON into document.ogdoc before Studio launch",
        data: { projectJson: paths.projectJson, documentPath: paths.documentFile, warnings: sanitized.warnings }
      });
      return {
        ok: true,
        sessionId,
        documentPath: paths.documentFile,
        repaired: true,
        projectId: sanitized.project.projectId,
        errors: [],
        warnings: [...warnings, ...sanitized.warnings],
        recovery: []
      };
    } catch (error) {
      return {
        ok: false,
        sessionId,
        documentPath: paths.documentFile,
        repaired: false,
        errors: [`Could not pack legacy project JSON into .ogdoc: ${error instanceof Error ? error.message : String(error)}`],
        warnings,
        recovery: [packCommand, ...recovery]
      };
    }
  }

  return {
    ok: false,
    sessionId,
    documentPath: paths.documentFile,
    repaired: false,
    errors: [`Session document is missing: ${paths.documentFile}.`],
    warnings,
    recovery
  };
}

async function markSessionEditingAfterDocumentPreflight(
  repo: string,
  session: Awaited<ReturnType<typeof readOpenGraphCreatorSession>>,
  documentPath: string,
  projectId: string
): Promise<void> {
  const hasActiveAgentRequest = (session.agentRequests ?? []).some((request) => request.status === "requested");
  if (
    session.status !== "waiting-for-agent" &&
    session.pendingAction !== "agent-generate-og-source" &&
    session.pendingAction !== "agent-revise-document" &&
    session.pendingAction !== "agent-restart-from-question-gate" &&
    !hasActiveAgentRequest
  ) {
    return;
  }
  await resolveActiveAgentRequestAfterDocumentReady({
    repo,
    sessionId: session.id,
    documentPath,
    projectId
  });
}

async function getSessionHealthWarnings(repo: string, sessionId: string, session: Awaited<ReturnType<typeof readOpenGraphCreatorSession>>): Promise<string[]> {
  const paths = getSessionPaths(repo, sessionId);
  const warnings: string[] = [];
  try {
    const exportState = JSON.parse(await readFile(paths.exportJson, "utf8")) as { exports?: unknown[] };
    const hasExportFileEntries = Array.isArray(exportState.exports) && exportState.exports.length > 0;
    if (hasExportFileEntries && session.exports.length === 0 && session.pendingAction === "agent-generate-og-source") {
      warnings.push(
        "Session has export.json entries but session.json is still waiting for generated OG source. Run export through OpenGraph Creator or repair the session before waiting/publishing."
      );
    }
  } catch {
    // Missing or malformed export state should not hide document validation results.
  }
  return warnings;
}

function formatSessionDocumentPreflightError(result: SessionDocumentPreflightResult): string {
  return [
    "Session document preflight failed.",
    ...result.errors.map((error) => `- ${error}`),
    "Recovery:",
    ...result.recovery.map((step) => `- ${step}`)
  ].join("\n");
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

async function readGeneratedEffectsPolicy(
  generationBriefPath: string
): Promise<{ allowNoise: boolean; maxNoiseAmount?: number }> {
  try {
    const raw = await readFile(generationBriefPath, "utf8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const policyText = String(parsed.noisePolicy ?? parsed.texturePolicy ?? "").toLowerCase();
    const deniesNoise = /\b(no|without|avoid|disable|remove|off)\b[^.]{0,48}\b(noise|grain|texture)\b/.test(policyText);
    const explicitAllow =
      parsed.allowNoise === true ||
      parsed.noisePolicy === "allowed" ||
      parsed.noisePolicy === "opt-in-approved" ||
      parsed.texturePolicy === "allowed" ||
      /\b(allow|allowed|approved|requested|explicit|opt-in)\b/.test(policyText);
    const maxNoiseAmount = typeof parsed.maxNoiseAmount === "number" ? parsed.maxNoiseAmount : undefined;
    return { allowNoise: explicitAllow && !deniesNoise, maxNoiseAmount };
  } catch {
    return { allowNoise: false };
  }
}

function sessionMatchesWaitTarget(session: Awaited<ReturnType<typeof readOpenGraphCreatorSession>>, target: SessionWaitTarget): boolean {
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
      (session.status === "agent-requested" && hasAgentRequest) ||
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

function parseInstallAgent(value?: string): "codex" | "claude" | "claude-code" | "opencode" | "all" | undefined {
  if (value === "codex" || value === "claude" || value === "claude-code" || value === "opencode" || value === "all") return value;
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
  if (value === "project-json" || value === "svg" || value === "html" || value === "image") return value;
  const normalized = source.toLowerCase();
  if (normalized.endsWith(".og.json") || normalized.endsWith(".json")) return "project-json";
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
  console.log(`OpenGraph Creator

Commands:
  opengraph-creator new --name <name> --strategy common|pages|hybrid --mode template|pure-image --preset founder-launch|product-shot|technical-article|studio-editorial|agent-canvas|release-notes --out project.og.json
  opengraph-creator save --project project.og.json
  opengraph-creator list
  opengraph-creator scan --repo <path>
  opengraph-creator brand inspect --repo <path> --json true
  opengraph-creator brand record-composition --repo <path> --session <id> --archetype <recipe-id> --concept "brief concept"
  opengraph-creator brief --repo <path> --name <app> --strategy common|pages|hybrid --mode template|pure-image --reference image.png --out .opengraph-creator/brief.json
  opengraph-creator brief lint --source .opengraph-creator/sessions/<id>/generation-brief.json --repo <path> --id <session-id>
  opengraph-creator assets lint --brief .opengraph-creator/sessions/<id>/generation-brief.json --repo <path> --id <session-id>
  opengraph-creator design lint --source .opengraph-creator/sessions/<id>/document.ogdoc --repo <path> --id <session-id>
  opengraph-creator import --source generated.svg --kind svg --name <app> --out project.og.json
  opengraph-creator install-skill --agent codex --scope global|project  (fallback only; valid agents: codex, claude-code, opencode, all)
  opengraph-creator document new --name <app> --out project.ogdoc
  opengraph-creator document pack --project project.og.json --out project.ogdoc
  opengraph-creator document validate --source project.ogdoc
  opengraph-creator session create --repo <path> --agent codex --strategy common|pages|hybrid
  opengraph-creator session attach --repo <path> --project <project-id-or-ogdoc> --agent codex --launch true --wait true
  opengraph-creator session open --repo <path> --id <session-id>
  opengraph-creator session launch --repo <path> --id <session-id> --open true --waitReady true --json
  opengraph-creator session validate --repo <path> --id <session-id> --repair true
  opengraph-creator session wait --id <session-id> --until exported|publish-preview|publish-confirmed|agent-request|next-action|terminal --timeout 30000|0|never
  opengraph-creator session cancel --repo <path> --id <session-id> --reason "User cancelled"
  opengraph-creator session status --id <session-id>
  opengraph-creator studio --port 5123 --repo <path>
  opengraph-creator render --name <name> --out og.svg
  opengraph-creator render check --source .opengraph-creator/sessions/<id>/document.ogdoc --repo <path> --id <session-id>
  opengraph-creator export --project project.og.json --format png|webp|jpg|svg --out public/og.png --session <session-id>
  opengraph-creator export --project project.og.json --format png|webp|jpg|svg --allPages true --outDir public/og --session <session-id>
  opengraph-creator export-source --format psd --source project.ogdoc --out public/og/open-graph.psd
  opengraph-creator variants --project project.og.json --outDir og-projects
  opengraph-creator agent-handoff --project project.og.json --prompt "art direction" --out public/og-agent.png --plan .opengraph-creator/agent-handoff.json
  opengraph-creator agent-image --project project.og.json --out public/og-agent.png
  opengraph-creator ai-image --project project.og.json --out public/og-agent.png
  opengraph-creator library-export --projectId <id> --format png --out public/og.png
  opengraph-creator apply --framework next --image public/og.png --preview
  opengraph-creator apply --framework next --image public/og.png --confirm
  opengraph-creator publish --preview --session <session-id> --image public/og.png
  opengraph-creator publish --confirm --session <session-id> --image public/og.png
  opengraph-creator publish --preview --session <session-id> --allPages true
  opengraph-creator publish --confirm --session <session-id> --allPages true
  opengraph-creator update check --json
  opengraph-creator doctor
`);
}

async function readProjectForSourceExport(source: string): Promise<OgProject> {
  if (source.toLowerCase().endsWith(".ogdoc")) {
    return (await readStudioDocumentFile(source)).project;
  }
  return JSON.parse(await readFile(source, "utf8")) as OgProject;
}

async function sessionExists(repo: string, sessionId: string): Promise<boolean> {
  try {
    await readOpenGraphCreatorSession(repo, sessionId);
    return true;
  } catch {
    return false;
  }
}

function printDoctorReport(report: DoctorReport): void {
  console.log("OpenGraph Creator doctor");
  for (const check of report.checks) {
    const marker = check.status === "pass" ? "PASS" : check.status === "warn" ? "WARN" : "FAIL";
    console.log(`- ${marker} ${check.label}: ${check.detail}`);
    if (check.action) console.log(`  Action: ${check.action}`);
  }
}

async function hasBundledSkillSource(): Promise<boolean> {
  const candidates = [
    new URL("../../../skills/opengraph-creator/SKILL.md", import.meta.url),
    new URL("../bundled-skill/SKILL.md", import.meta.url),
    new URL("../../bundled-skill/SKILL.md", import.meta.url),
    new URL("../codex-skill/SKILL.md", import.meta.url),
    new URL("../../codex-skill/SKILL.md", import.meta.url)
  ];
  for (const candidate of candidates) {
    if (await pathExists(fileURLToPath(candidate))) return true;
  }
  return false;
}

function getSkillCandidates(home: string): string[] {
  return [
    join(home, ".codex", "skills", "opengraph-creator", "SKILL.md"),
    join(home, ".claude", "skills", "opengraph-creator", "SKILL.md"),
    join(home, ".config", "opencode", "skill", "opengraph-creator", "SKILL.md"),
    join(home, ".config", "opencode", "skills", "opengraph-creator", "SKILL.md"),
    join(home, ".agents", "skills", "opengraph-creator", "SKILL.md"),
    join(home, ".opencode", "skill", "opengraph-creator", "SKILL.md")
  ];
}

async function readInstalledSkillStatuses(home: string, bundledVersion?: string): Promise<InstalledSkillStatus[]> {
  const statuses: InstalledSkillStatus[] = [];
  for (const path of getSkillCandidates(home)) {
    if (!(await pathExists(path))) continue;
    const content = await readFile(path, "utf8");
    const version = extractSkillVersion(content);
    const status: InstalledSkillStatus["status"] =
      bundledVersion && version
        ? compareVersions(version, bundledVersion) >= 0
          ? "fresh"
          : "stale"
        : "unknown";
    statuses.push({ path, version, status });
  }
  return statuses;
}

async function readBundledSkillVersion(): Promise<string | undefined> {
  const candidates = [
    new URL("../../../skills/opengraph-creator/SKILL.md", import.meta.url),
    new URL("../bundled-skill/SKILL.md", import.meta.url),
    new URL("../../bundled-skill/SKILL.md", import.meta.url),
    new URL("../codex-skill/SKILL.md", import.meta.url),
    new URL("../../codex-skill/SKILL.md", import.meta.url)
  ];
  for (const candidate of candidates) {
    try {
      return extractSkillVersion(await readFile(fileURLToPath(candidate), "utf8"));
    } catch {
      // Try the next source location.
    }
  }
  return undefined;
}

function extractSkillVersion(content: string): string | undefined {
  return /opengraph_creator_skill_version:\s*["']?([0-9]+\.[0-9]+\.[0-9]+)["']?/i.exec(content)?.[1];
}

async function readCurrentRuntimeVersion(): Promise<string> {
  try {
    const packageJson = JSON.parse(await readFile(fileURLToPath(new URL("../package.json", import.meta.url)), "utf8")) as { version?: string };
    return packageJson.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

async function fetchLatestRuntimeVersion(): Promise<string | undefined> {
  try {
    const response = await fetch("https://registry.npmjs.org/opengraph-creator/latest", {
      signal: AbortSignal.timeout(1800)
    });
    if (!response.ok) return undefined;
    const body = await response.json() as { version?: string };
    return body.version;
  } catch {
    return undefined;
  }
}

function compareVersions(a: string, b: string): number {
  const left = a.split(".").map((part) => Number.parseInt(part, 10) || 0);
  const right = b.split(".").map((part) => Number.parseInt(part, 10) || 0);
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const diff = (left[index] ?? 0) - (right[index] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
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
      await copyFile(file, `${file}.opengraph-creator.bak`);
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

async function runCliEntrypoint(argv: string[]): Promise<void> {
  const [command, subcommand] = argv;
  const update = await createUpdateReport({ home: parseEntrypointHome(argv) });
  if (shouldAutoRefreshRuntime({
    command,
    currentVersion: update.runtime.currentVersion,
    latestVersion: update.runtime.latestVersion,
    env: process.env
  })) {
    const result = spawnSync("npx", ["-y", "opengraph-creator@latest", ...argv], {
      stdio: "inherit",
      env: { ...process.env, OPENGRAPH_CREATOR_AUTO_UPDATED: "1" },
      shell: process.platform === "win32"
    });
    process.exitCode = result.status ?? 1;
    return;
  }

  if (isGenerationBoundaryCommand(command, subcommand) && update.skill.updateRequired) {
    console.error("OpenGraph Creator skill is missing or stale. Update the skill, then start a new agent session.");
    for (const command of update.skill.manualUpdateCommands) console.error(command);
    process.exitCode = 1;
    return;
  }

  await runCli(argv);
}

function isGenerationBoundaryCommand(command?: string, subcommand?: string): boolean {
  return command === "session" && (subcommand === "create" || subcommand === "attach");
}

function parseEntrypointHome(argv: string[]): string | undefined {
  const index = argv.indexOf("--home");
  if (index >= 0) return argv[index + 1];
  const equals = argv.find((item) => item.startsWith("--home="));
  return equals?.slice("--home=".length);
}

if (isCliEntrypoint()) {
  runCliEntrypoint(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
