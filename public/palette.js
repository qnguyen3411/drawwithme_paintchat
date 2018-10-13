class Palette {

  constructor(palCanvas, imgUrl) {
    this.canvas = palCanvas;
    this.palCtx = palCanvas.getContext('2d');
    this.setPalImage(imgUrl)
  }

  setPalImage(url) {
    const img = new Image()
    img.setAttribute("src", url)
    img.addEventListener("load",() => {
      this.palCtx.drawImage(
        img, 0, 0, this.palCtx.canvas.width, this.palCtx.canvas.height)
    })
  }

  getColor(mousePos) {
    return this.palCtx.getImageData(mousePos.x, mousePos.y, 1, 1).data;
  }

}