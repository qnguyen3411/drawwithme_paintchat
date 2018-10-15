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
    this.minX;
    this.minY;
    this.maxX;
    this.maxY;
  }

  setBrush(rgba, size) {
    this.rgba = rgba;
    this.size = size;
    this.ctx.strokeStyle = `rgba(${rgba.join(', ')})`;
    this.ctx.fillStyle = `rgba(${rgba.join(', ')})`;
    this.ctx.lineWidth = size;
    return this;
  }

  draw(ctx) {
    ctx.beginPath(); 
    if(this.x.length == 1) { // if drawing a dot
      ctx.lineWidth = 1;
      ctx.arc(this.x[0], this.y[0], this.size / 2, 0 , 2 * Math.PI, false);
      ctx.fill();
      ctx.lineWidth = this.size;
    } else {
      const len = this.x.length;
      ctx.moveTo(this.x[0], this.y[0]);
      for (let i = 1; i < len; i++) {
        ctx.lineTo(this.x[i], this.y[i]);
      }
      ctx.stroke();
    }
    return this;
  }

  start(startX, startY) {
    this.x = [startX];
    this.y = [startY];
    this.minX = startX;
    this.maxX = startX;
    this.minY = startY;
    this.maxY = startY;
    this.draw(this.ctx);
    return this;
  }

  update(newX, newY) {
    if(this.minX > newX)       { this.minX = newX }
    else if (this.maxX < newX) { this.maxX = newX };
    if(this.minY > newY)       { this.minY = newY }
    else if (this.maxY < newY) { this.maxY = newY };
    
    this.x.push(newX);
    this.y.push(newY);
    this.ctx.clearRect(...this.boundingRectPoints());
    this.draw(this.ctx);
    return this;
  }

  end() {
    this.ctx.clearRect(...this.boundingRectPoints());
    const base = this.baseCtx
    base.lineWidth = this.size;
    base.strokeStyle = `rgba(${this.rgba.join(', ')})`;
    base.fillStyle = `rgba(${this.rgba.join(', ')})`;
    this.draw(base);
    return this;
  }

  boundingRectPoints() {
    const {width, height} = this.ctx.canvas
    return [
      Math.max(this.minX - this.size / 2, 0),
      Math.max(this.minY - this.size / 2, 0),
      Math.min(this.maxX + this.size / 2, width),
      Math.min(this.maxY + this.size / 2, height),
    ]
  }

  getData() {
    return {
      rgba: this.rgba,
      size: this.size,
      x: this.x,
      y: this.y
    }
  }
}