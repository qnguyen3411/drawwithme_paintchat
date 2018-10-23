class PanModule {
  static setPannable(scroller) {
    return new PanModule(scroller);
  }

  constructor(scroller) {
    this.scroller = scroller;
    this.ctrlDragging = false;
    this.x;
    this.y;
    this.setEventListeners();
  }

  setEventListeners() {
    this.scroller.onmousedown = (e) => {
      if (e.ctrlKey || e.metaKey) {
        this.x = e.clientX
        this.y = e.clientY
        this.ctrlDragging = true;
      }
    }
    this.scroller.onmousemove = (e) => {
      if ((e.ctrlKey || e.metaKey) && this.ctrlDragging) {
        this.scroller.scrollTop += (this.y - e.clientY)
        this.scroller.scrollLeft += (this.x - e.clientX)
        this.x = e.clientX;
        this.y = e.clientY;
      }
    }
    const done = () => { this.ctrlDragging = false }
    this.scroller.onmouseup = done;
    this.scroller.onmouseleave = done;
  }
}