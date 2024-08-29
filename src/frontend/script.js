const { pdfjsLib } = globalThis

pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.mjs/"

async function renderPage(page, canvas, parentWidth) {
  const canvasContext = canvas.getContext("2d")

  const initialViewport = page.getViewport({ scale: 1 })
  const scale = parentWidth / initialViewport.width

  const viewport = page.getViewport({ scale: scale })
  canvas.width = viewport.width
  canvas.height = viewport.height

  await page.render({
    canvasContext: canvasContext,
    viewport: viewport,
  })
}

function renderPDF() {
  pdfjsLib.getDocument("/pdf/").promise.then(async (pdf) => {
    const pages = pdf.numPages
    const pagesContainer = document.getElementById("pages-container")

    const width = pagesContainer.offsetWidth

    for (let i = 0; i < pages; i++) {
      let canvas = null
      if (pagesContainer.children.length <= i) {
        canvas = document.createElement("canvas")
        pagesContainer.appendChild(canvas)
      } else {
        canvas = pagesContainer.children.item(i)
      }

      renderPage(await pdf.getPage(i + 1), canvas, width)
    }
  })
}

renderPDF()