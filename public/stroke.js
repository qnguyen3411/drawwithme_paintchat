class Stroke {

  constructor(ctx, baseCtx) {
    this.ctx = ctx;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.baseCtx = baseCtx;
    this.baseCtx.lineCap = 'round';
    this.baseCtx.lineJoin = 'round';
    this.rgba = [0, 0, 0, 1];
    this.size = 1;
    this.x = [];
    this.y = [];
  }

  getBrushSettings(rgba, size) {
    this.rgba = rgba;
    this.size = size;
    this.ctx.strokeStyle = `rgba(${rgba.join(', ')})`;
    this.ctx.fillStyle = `rgba(${rgba.join(', ')})`;
    this.ctx.lineWidth = size;
  }

  draw(ctx) {
    ctx.beginPath(); 
    if(this.x.length == 1) { // if drawing a dot
      ctx.lineWidth = 1;
      ctx.arc(this.x[0], this.y[0], this.size / 2, 0 , 2 * Math.PI, false);
      ctx.fill();
      ctx.lineWidth = this.size;
    } else {
      ctx.moveTo(this.x[0], this.y[0]);
      for (let i = 1; i < this.x.length; i++) {
        ctx.lineTo(this.x[i], this.y[i]);
      }
      ctx.stroke();
    }
  }

  start(startX, startY) {
    this.x = [startX];
    this.y = [startY];
    this.draw(this.ctx);
  }

  update(newX, newY) {
    this.x.push(newX);
    this.y.push(newY);
    this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
    this.draw(this.ctx);
  }

  end() {
    this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
    this.baseCtx.lineWidth = this.size;
    this.baseCtx.strokeStyle = `rgba(${this.rgba.join(', ')})`;
    this.baseCtx.fillStyle = `rgba(${this.rgba.join(', ')})`;
    this.draw(this.baseCtx);
  }
}