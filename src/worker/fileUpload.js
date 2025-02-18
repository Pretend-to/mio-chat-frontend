// worker.js (计算 MD5)
import SparkMD5 from 'spark-md5';

self.onmessage = function (e) {
  const { file, chunkSize } = e.data;

  if (!file) {
    self.postMessage({ error: 'No file provided' });
    return;
  }

  const spark = new SparkMD5.ArrayBuffer();
  let currentChunk = 0;
  const totalChunks = Math.ceil(file.size / chunkSize);
  const fileReader = new FileReader();

  fileReader.onload = function (e) {
    spark.append(e.target.result);
    currentChunk++;

    // Send progress update (for MD5 calculation)
    self.postMessage({ md5Progress: (currentChunk / totalChunks) * 100 });

    if (currentChunk < totalChunks) {
      loadNextChunk();
    } else {
      const hash = spark.end();
      self.postMessage({ hash }); // Final MD5
    }
  };

  fileReader.onerror = function () {
    self.postMessage({ error: 'Error reading file' });
  };

  function loadNextChunk() {
    const start = currentChunk * chunkSize;
    const end = Math.min(start + chunkSize, file.size);
    fileReader.readAsArrayBuffer(file.slice(start, end));
  }

  loadNextChunk();
};