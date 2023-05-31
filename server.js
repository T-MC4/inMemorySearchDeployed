import { checkFileExists } from "./utils/ingestion.js";
import { loadModel } from "./utils/embedding.js";
import {
  loadIndexFromFile,
  buildIndexing,
  addEmbeddings,
  returnMatchedFiller,
  deleteFromIndex,
} from "./utils/indexing.js";
import express from "express";

const app = express();
const port = process.env.PORT || 3000;
app.use(express.json());

// ------------------------------------------------------------------------------------------- //
// IMPLEMENT THIS INTO AIRCHAT SO THAT IT ONLY RUNS ONCE (IDEALLY BEFORE THE CALL EVEN STARTS) //
// ------------------------------------------------------------------------------------------- //

const DEBUG = true;
const numDimensions = 512; // the length of data point vector that will be indexed.
const maxElements = 100000; // the maximum number of data points.
const dataProcessingPath = "./data/to_process";
const dataProcessedPath = "./data/processed";
const indexingPath = "./data/indexing/vectorIndex.hnsw";
const contentsMapPath = "./data/indexing/contentsMap.json";
const NN = 5; // the number of nearest neighbors to search.
let indexing, model;

// ----------------------------------------------------- //
// MAKE QUERIES TO THE VECTOR STORE (See Examples Below) //
// ----------------------------------------------------- //
// Get Matched Filler
app.get("/api/match", async (req, res) => {
  const sentence = req.query.sentence;
  const nearestNeighbors = parseInt(req.query.neighbors) || NN;
  if (!sentence) {
    res.status(400).send({ error: "Missing sentence parameter" });
    return;
  }
  const results = await returnMatchedFiller(
    indexing,
    model,
    sentence,
    nearestNeighbors,
    DEBUG
    // contentsMapPath // This is optional Search post processing to append the contents text to the matched embeddings
  );
  res.send(results);
});

// update embeddings
app.post("/search/update", async (req, res) => {
  // Add any embeddings grabbed from the to_process folder earlier
  await addEmbeddings(
    model,
    dataProcessingPath,
    dataProcessedPath,
    indexingPath,
    indexing,
    DEBUG,
    contentsMapPath
  );
  res.json({
    message: "Embeddings Updated",
  });
});

// ------------------------------------------------------------ //
// DELETE EMBEDDINGS FROM THE VECTOR STORE (See Examples Below) //
// ------------------------------------------------------------ //
// Delete Embedding
app.delete("/api/embeddings/:id", async (req, res) => {
  const idToDelete = parseInt(req.params.id);
  if (!idToDelete) {
    res.status(400).send({ error: "Missing id parameter" });
    return;
  }
  deleteFromIndex(indexingPath, indexing, idToDelete, DEBUG);
  res.send({ success: `Embedding ${idToDelete} deleted.` });
});

// Start the server
app.listen(port, async () => {
  model = await loadModel(DEBUG);

  // Check if the indexing exists
  const is_existing_index = await checkFileExists(indexingPath);

  // Load the existing index of create a new one
  if (is_existing_index) {
    console.log("Static Index File Exists - Loading File");
    // Load the existing index
    indexing = await loadIndexFromFile(
      indexingPath,
      numDimensions,
      maxElements,
      DEBUG
    );
  } else {
    console.log("No Index File - Building From Scratch");
    // Build the new indexing
    indexing = await buildIndexing(
      indexingPath,
      numDimensions,
      maxElements,
      DEBUG
    );
  }

  // Add any embeddings grabbed from the to_process folder earlier
  await addEmbeddings(
    model,
    dataProcessingPath,
    dataProcessedPath,
    indexingPath,
    indexing,
    DEBUG,
    contentsMapPath
  );

  console.log(`Server listening on port ${port}`);
});
