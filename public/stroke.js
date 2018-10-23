class Stroke {
  constructor(ctx) {
    this.ctx = ctx;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.rgba = [0, 0, 0, 1];
    this.size = 1;
    this.x = [];
    this.y = [];
    this.minX;
    this.minY;
    this.maxX;
    this.maxY;
    this.finished = false;
  }

  setColor(rgba) {
    const cssString = `rgba(${rgba.join(', ')})`;
    this.rgba = rgba;
    this.ctx.strokeStyle = cssString;
    this.ctx.fillStyle = cssString;
    return this;
  }

  setSize(size) {
    this.size = size;
    this.ctx.lineWidth = size;
    return this;
  }

  draw(ctx) {
    ctx.beginPath();
    if (this.x.length === 1) { // if drawing a dot
      ctx.lineWidth = 1;
      ctx.arc(this.x[0], this.y[0], this.size / 2, 0, 2 * Math.PI);
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

  startAt(startX, startY) {
    this.x = [startX];
    this.y = [startY];
    this.minX = startX;
    this.maxX = startX;
    this.minY = startY;
    this.maxY = startY;
    this.draw(this.ctx);
    return this;
  }

  drawTo(newX, newY) {
    // Keep track of max and min
    if (this.minX > newX) { this.minX = newX }
    else if (this.maxX < newX) { this.maxX = newX };
    if (this.minY > newY) { this.minY = newY }
    else if (this.maxY < newY) { this.maxY = newY };

    this.x.push(newX);
    this.y.push(newY);
    this.ctx.clearRect(...this.boundingRectPoints());
    this.draw(this.ctx);
    return this;
  }

  end() {
    this.ctx.clearRect(...this.boundingRectPoints());
    this.finished = true;
    return this;
  }

  setOn(baseCtx) {
    const saved = {
      lineWidth : baseCtx.lineWidth,
      lineCap : baseCtx.lineCap,
      lineJoin : baseCtx.lineJoin,
      fillStyle : baseCtx.fillStyle,
      strokeStyle: baseCtx.strokeStyle
    }
    const keys = Object.keys(saved);
    keys.forEach(key => {
      baseCtx[key] = this.ctx[key];
    });
    this.draw(baseCtx);
    keys.forEach(key => {
      baseCtx[key] = saved[key];
    });
    return this;
  }

  boundingRectPoints() {
    const { width, height } = this.ctx.canvas;
    const radius = this.size / 2;
    return [
      Math.max(this.minX - radius, 0),
      Math.max(this.minY - radius - 5, 0), // Magic number alert
      Math.min(this.maxX + radius, width),
      Math.min(this.maxY + radius, height),
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