let { pdfjsLib } = globalThis;

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://unpkg.com/pdfjs-dist@4.6.82/build/pdf.worker.min.mjs";

const pdfjsWorker = new pdfjsLib.PDFWorker();

async function renderPage(page, canvas, parentWidth) {
  let canvasContext = canvas.getContext("2d");

  let initialViewport = page.getViewport({ scale: 1 });
  let scale = parentWidth / initialViewport.width;

  let viewport = page.getViewport({ scale: scale });
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  await page.render({
    canvasContext: canvasContext,
    viewport: viewport,
  });
}

export function renderPDF() {
  pdfjsLib
    .getDocument({
      url: "/pdf/",
      worker: pdfjsWorker,
    })
    .promise.then(async (pdf) => {
      let pages = pdf.numPages;
      let pagesContainer = document.getElementById("pages-container");

      let width = pagesContainer.offsetWidth;

      for (let i = 0; i < pages; i++) {
        let canvas = null;
        if (pagesContainer.childNodes.length <= i) {
          canvas = document.createElement("canvas");
          pagesContainer.appendChild(canvas);
        } else {
          canvas = pagesContainer.childNodes.item(i);
        }

        renderPage(await pdf.getPage(i + 1), canvas, width);
      }
    });
}
