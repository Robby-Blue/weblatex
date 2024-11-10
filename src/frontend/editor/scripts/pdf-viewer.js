let { pdfjsLib } = globalThis;

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://unpkg.com/pdfjs-dist@4.6.82/legacy/build/pdf.worker.min.mjs";

const pdfjsWorker = new pdfjsLib.PDFWorker();

let pathName = window.location.pathname;
let projectPath = pathName.substring("/editor/".length);

async function renderPage(page, canvas, parentWidth) {
  // afaik force the pdf to render at 1080 pixels
  // and upscale/downscale? it to fit that
  let horizontalResolution = 1080;
  let resolutionScale = horizontalResolution / parentWidth;

  let canvasContext = canvas.getContext("2d");

  let initialViewport = page.getViewport({ scale: 1 });
  let scale = parentWidth / initialViewport.width;

  let viewport = page.getViewport({ scale: scale });
  canvas.width = viewport.width * resolutionScale;
  canvas.height = viewport.height * resolutionScale;
  canvas.style.width = viewport.width + "px";
  canvas.style.height = viewport.height + "px";

  await page.render({
    canvasContext: canvasContext,
    viewport: viewport,
    transform: [resolutionScale, 0, 0, resolutionScale, 0, 0],
  });
}

export function renderPDF() {
  pdfjsLib
    .getDocument({
      url: `/api/projects/pdf/${projectPath}`,
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
