import { join } from "node:path";
import { mkdir } from "node:fs/promises";
import {
  BaseBuilder,
  createBaseBuilderConfig,
} from "@workflow/builders";
import { initDataDir } from "@workflow/world-local";

/**
 * Custom VitestBuilder that scans only the `examples/` directory
 * while keeping project root as the working dir (so workflow IDs
 * match what the SWC transform plugin generates from process.cwd()).
 */
class ExamplesBuilder extends BaseBuilder {
  #outDir: string;

  constructor(projectRoot: string, outDir: string) {
    super({
      ...createBaseBuilderConfig({
        workingDir: projectRoot,
        dirs: ["examples"],
      }),
      buildTarget: "next" as const,
      suppressCreateWorkflowsBundleLogs: true,
      suppressCreateWebhookBundleLogs: true,
      suppressCreateManifestLogs: true,
    });
    this.#outDir = outDir;
  }

  get shouldLogBaseBuilderInfo() {
    return false;
  }

  async build() {
    const inputFiles = await this.getInputFiles();
    await mkdir(this.#outDir, { recursive: true });

    await this.createWorkflowsBundle({
      outfile: join(this.#outDir, "workflows.mjs"),
      bundleFinalOutput: false,
      format: "esm",
      inputFiles,
    });

    await this.createStepsBundle({
      outfile: join(this.#outDir, "steps.mjs"),
      externalizeNonSteps: true,
      rewriteTsExtensions: true,
      format: "esm",
      inputFiles,
    });
  }
}

export async function setup() {
  const root = process.cwd();
  const outDir = join(root, ".workflow-vitest");
  const builder = new ExamplesBuilder(root, outDir);
  await builder.build();
  await initDataDir(join(root, ".workflow-data"));
}
