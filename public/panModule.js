class PanModule {
  static setPannable(scroller) {
    return new PanModule(scroller);
  }

  constructor(scroller) {
    this.scroller = scroller;
    this.ctrlDragging = false;
    this.x = [];
    this.y = [];
    this.setEventListeners();
  }

  setEventListeners() {
    $(this.scroller)
    .mousedown((e) => {
      if (e.ctrlKey || e.metaKey) {
        this.x = [e.clientX]
        this.y = [e.clientY]
        this.ctrlDragging = true;
      }
    }).mousemove((e) => {
      if ((e.ctrlKey || e.metaKey) && this.ctrlDragging){
        $(this.scroller).scrollTop(
          $(this.scroller).scrollTop() - e.clientY + this.y.pop())
        $(this.scroller).scrollLeft(
          $(this.scroller).scrollLeft() - e.clientX + this.x.pop())
        this.x.push(e.clientX);
        this.y.push(e.clientY);
      }
    }).on('mouseup mouseleave', () =>  this.ctrlDragging = false);
   
  }
}