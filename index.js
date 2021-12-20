const express = require("express");
const app = express();
require("dotenv/config");
const cors = require("cors");
const axios = require("axios").default;
const path = require("path");
const fs = require("fs");
const imagesToPdf = require("images-to-pdf");
const SHA256 = require("crypto-js/sha256");

app.use(express.json());
app.use(cors({ origin: true }));
app.enable("trust proxy");

app.get("/", (req, res) => {
  res.send("URLs to PDF");
});

app.post("/pdf", async (req, res) => {
  try {
    if (!req.body.urls)
      return res.status(400).send({
        message: "URLs are required",
      });
    const pdfId = SHA256(req.body.urls.join("-")).toString();

    await Promise.all(
      req.body.urls.map((url) => {
        return new Promise((resolve, reject) => {
          const dirPath = path.join(
            __dirname,
            "images",
            SHA256(url).toString()
          );
          const imagePath = path.join(dirPath, "image.png");

          fs.mkdirSync(dirPath, {
            recursive: true,
          });

          if (!fs.existsSync(imagePath))
            axios
              .get(url, {
                responseType: "arraybuffer",
                headers: {
                  referer: req.body.origin || "",
                  origin: req.body.origin || "",
                },
              })
              .then((response) => {
                fs.writeFileSync(imagePath, response.data);

                resolve();
              })
              .catch(reject);
          else resolve();
        });
      })
    );

    fs.mkdirSync(path.join(__dirname, "pdf", pdfId), { recursive: true });

    await imagesToPdf(
      req.body.urls.map((url) =>
        path.join(__dirname, "images", SHA256(url).toString(), "image.png")
      ),
      path.join(__dirname, "pdf", pdfId, `${req.body.filename || "file"}.pdf`)
    );

    res.send({
      message: "Conversion succeeded",
      url: `${req.protocol}://${req.get("host")}/static/${pdfId}`,
      downloadUrl: `${req.protocol}://${req.get("host")}/static/${pdfId}?dl=1`,
    });
  } catch (error) {
    console.log(error);
    if (!res.headersSent)
      res.status(500).send({
        message: "The server went wrong",
        error,
      });
  }
});

app.get("/static/:id", (req, res) => {
  try {
    const dirPath = path.join(__dirname, "pdf", req.params.id);
    if (fs.existsSync(dirPath)) {
      const existingFile = fs.readdirSync(dirPath)[0];

      if (Number(req.query.dl)) res.download(path.join(dirPath, existingFile));
      else res.sendFile(path.join(dirPath, existingFile));
    } else {
      res.status(404).send({
        message: "File not found",
      });
    }
  } catch (error) {
    console.log(error);
    if (!res.headerSent)
      res.status(500).send({
        message: "The server went wrong",
      });
  }
});

const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`Server is listening on port ${port}`));
