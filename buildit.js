// build.js
const fs = require("fs");
const path = require("path");
const nunjucks = require("nunjucks");
const matter = require("gray-matter");

// Get command-line flags
const args = process.argv.slice(2);
const deleteDestFolder = args.includes("delete");
const compressAssets = args.includes("compress");
const environment = args.includes("prod") ? "production" : "local";

// Load env config
let getEnvConfig;
let env = {};
if (fs.existsSync("./_data/env.js")) {
  getEnvConfig = require("./_data/env.js");
  env = getEnvConfig(environment);
}

// Load API data and continue build
let getapiData;
let apiData = [];

if (fs.existsSync("./_data/api.js")) {
  (async () => {
    try {
      getapiData = require("./_data/api.js");
      apiData = await getapiData(env);
      apiData = apiData.apiData || apiData;
      processTemplates();
    } catch (error) {
      console.error("❌ Error fetching API data:", error);
    }
  })();
} else {
  processTemplates();
}

function processTemplates() {
  const sourceFolder = "./_source";
  const includesFolder = "./_includes";
  const destBaseFolder = "./_site";
  const assetsFolder = path.join(sourceFolder, "assets");

  // Delete `_site` folder if delete flag is passed
  if (deleteDestFolder) {
    try {
      console.log("🗑 Deleting _site folder before build...");
      fs.rmSync(destBaseFolder, { recursive: true, force: true });
    } catch (err) {
      console.error("❌ Failed to delete _site folder:", err);
    }
  }

  // Ensure destination folder exists
  if (!fs.existsSync(destBaseFolder)) {
    fs.mkdirSync(destBaseFolder, { recursive: true });
  }

  // Configure Nunjucks
  nunjucks.configure([sourceFolder, includesFolder], {
    autoescape: false,
    noCache: true,
  });

  // Utility: Copy folder
  function copyDirectory(src, dest) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    fs.readdirSync(src).forEach((item) => {
      const srcPath = path.join(src, item);
      const destPath = path.join(dest, item);
      if (fs.lstatSync(srcPath).isDirectory()) {
        copyDirectory(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    });
  }

  // Copy assets
  if (fs.existsSync(assetsFolder)) {
    const destAssetsFolder = path.join(destBaseFolder, "assets");
    copyDirectory(assetsFolder, destAssetsFolder);
    console.log(`✅ Copied assets folder to ${destAssetsFolder}`);
  }

  // Generate content with/without pagination
  async function generateContent(
    dataArray,
    size,
    alias,
    permalinkTemplate,
    layout,
    env,
    outputFolders,
    isIndexFile
  ) {
    if (dataArray && dataArray.length > 0) {
      const totalPages = Math.ceil(dataArray.length / size);
      for (let i = 0; i < totalPages; i++) {
        const pageData = dataArray.slice(i * size, (i + 1) * size);
        for (const pageItem of pageData) {
          //Skip rendering if pageName is 'index' to avoid unwanted /root/index.html
          if (pageItem.pageName === "index") continue;

          const permalink = nunjucks.renderString(permalinkTemplate, {
            [alias]: pageItem,
          });
          const pageContent = nunjucks.renderString(layout, {
            ...env,
            content: pageItem,
            apiData,
          });
          for (const outputFolder of outputFolders) {
            const outputPath = path.join(
              destBaseFolder,
              outputFolder,
              permalink,
              "index.html"
            );
            const outputDir = path.dirname(outputPath);
            if (!fs.existsSync(outputPath)) {
              await fs.promises.mkdir(outputDir, { recursive: true });
              await fs.promises.writeFile(outputPath, pageContent, "utf8");
              console.log(`✅ Created ${outputPath}`);
            } else {
              console.log(`⚠️ Skipped ${outputPath} (already exists)`);
            }
          }
        }
      }
    } else {
      for (const outputFolder of outputFolders) {
        let outputPath;
        if (isIndexFile) {
          outputPath = path.join(destBaseFolder, "index.html");
        } else {
          const renderedPermalink = nunjucks
            .renderString(permalinkTemplate, env)
            .trim();
          outputPath =
            !renderedPermalink ||
            renderedPermalink === "/" ||
            renderedPermalink === "index"
              ? path.join(destBaseFolder, outputFolder, "index.html")
              : path.join(
                  destBaseFolder,
                  outputFolder,
                  renderedPermalink,
                  "index.html"
                );
        }
        const outputDir = path.dirname(outputPath);
        const pageContent = nunjucks.renderString(layout, {
          ...env,
          content: {},
          apiData,
        });
        if (!fs.existsSync(outputPath)) {
          await fs.promises.mkdir(outputDir, { recursive: true });
          await fs.promises.writeFile(outputPath, pageContent, "utf8");
          console.log(`✅ Created ${outputPath}`);
        } else {
          console.log(`⚠️ Skipped ${outputPath} (already exists)`);
        }
      }
    }
  }

  // Process all .njk files
  fs.readdir(sourceFolder, async (err, files) => {
    if (err) return console.error("❌ Error reading source folder:", err);

    for (const file of files) {
      const sourceFilePath = path.join(sourceFolder, file);
      if (path.extname(file) === ".njk") {
        try {
          const raw = await fs.promises.readFile(sourceFilePath, "utf8");
          const { content, data: frontMatter } = matter(raw);

          let finalContent = content;
          if (frontMatter.layout) {
            const layoutPath = path.join(
              includesFolder,
              frontMatter.layout.endsWith(".njk")
                ? frontMatter.layout
                : frontMatter.layout + ".njk"
            );
            const layoutData = await fs.promises.readFile(layoutPath, "utf8");
            finalContent = nunjucks.renderString(layoutData, {
              ...env,
              content,
              apiData,
            });
          } else {
            finalContent = nunjucks.renderString(content, {
              ...env,
              apiData,
            });
          }

          const outputFolders = (
            frontMatter.outputFolder || path.basename(file, ".njk")
          )
            .split(",")
            .map((f) => f.trim());

          if (frontMatter.pagination) {
            const paginationData = eval(frontMatter.pagination.data); // ⚠ Consider making this safer
            const size = frontMatter.pagination.size || 1;
            const alias = frontMatter.pagination.alias || "contentarray";
            const permalink = frontMatter.permalink || "/";
            await generateContent(
              paginationData,
              size,
              alias,
              permalink,
              finalContent,
              env,
              outputFolders,
              file === "index.njk"
            );
          } else {
            await generateContent(
              [],
              1,
              "content",
              frontMatter.permalink || "/",
              finalContent,
              env,
              outputFolders,
              file === "index.njk"
            );
          }
        } catch (err) {
          console.error(`❌ Error processing ${file}:`, err);
        }
      }
    }

    // Compress assets if flag enabled
    if (compressAssets) {
      try {
        const compress = require("compression-library"); // Replace with your compression lib
        compress(assetsFolder);
        console.log("✅ Assets compressed successfully");
      } catch (err) {
        console.error("❌ Asset compression failed:", err);
      }
    }
  });
}
