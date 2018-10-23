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
      lineWidth: baseCtx.lineWidth,
      lineCap: baseCtx.lineCap,
      lineJoin: baseCtx.lineJoin,
      fillStyle: baseCtx.fillStyle,
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

class Palette {

  constructor(palCanvas, imgUrl) {
    this.canvas = palCanvas;
    this.palCtx = palCanvas.getContext('2d');
    this.setPalImage(imgUrl)
  }

  setPalImage(url) {
    const img = new Image()
    img.setAttribute("src", url)
    img.addEventListener("load", () => {
      this.palCtx.drawImage(
        img, 0, 0, this.palCtx.canvas.width, this.palCtx.canvas.height)
    })
  }

  getColor(mousePos) {
    return this.palCtx.getImageData(mousePos.x, mousePos.y, 1, 1).data;
  }

}

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

(function activate() {
  let socket = io.connect('http://127.0.0.1:5000/');
  let ctxDict = {}

  let base = document.getElementById('lower').getContext('2d');
  let upper = document.getElementById('upper').getContext('2d');
  let myStroke;
  let size = 1;
  let palette = new Palette(document.querySelector('#palette canvas'), 'http://localhost:5000/palette.png')
  PanModule.setPannable(document.getElementById('canvasWindow'));
  const container = document.getElementById('canvasContainer')

  const token = document.getElementById('token').innerHTML;
  socket.emit('join', { token })

  let colorPicker = {
    slider1: document.getElementById('slider1'),
    slider2: document.getElementById('slider2'),
    slider3: document.getElementById('slider3'),
    aSlider: document.getElementById('slider4'),
    colorBox: document.getElementById('colorBox'),

    mode: 'rgba',

    changeMode: function (mode) {
      if (this.mode != mode && (mode == 'rgba' || mode == 'hsla')) {
        const colorTransform = this[(this.mode == 'rgba') ? 'rgbToHsl' : 'hslToRgb'];
        this.mode = mode;
        newVals = colorTransform(...this.sliderVals());
        this.updateSliderRange(mode);
        this.updateSliderNames(mode);
        this.setSliders(...newVals);
      }
    },

    colorSliders: function () {
      return [this.slider1, this.slider2, this.slider3];
    },

    sliderVals: function () {
      return this.colorSliders().map(sl => sl.value);
    },

    alphaVal: function () {
      return this.aSlider.value / 100;
    },

    rgba: function () {
      if (this.mode == 'rgba') {
        return [...this.sliderVals(), this.alphaVal()];
      } else {
        const rgbVals = this.hslToRgb(...this.sliderVals());
        return [...rgbVals, this.alphaVal()];
      }
    },

    setSliders: function (val1, val2, val3) {
      this.slider1.value = val1;
      this.slider2.value = val2;
      this.slider3.value = val3;
      this.slider3.dispatchEvent(new Event('change'))
    },

    setSlidersWithRgbVals: function (val1, val2, val3) {
      if (this.mode == 'rgba') {
        this.setSliders(val1, val2, val3);
        return;
      }
      const hsl = this.rgbToHsl(val1, val2, val3);
      this.setSliders(...hsl);
    },

    updateSliderRange(mode) {
      const bounds = (mode == 'rgba') ? [255, 255, 255] : [360, 100, 100];
      bounds.map((maxVal, index) => {
        const thisSlider = this[`slider${index + 1}`]
        thisSlider.max = maxVal
      })
    },

    updateSliderNames(mode) {
      mode.split("").forEach((char, index) => {
        const selector = (index === 3) ? 'aSlider' : `slider${index + 1}`;
        this[selector].previousSibling.innerHTML = char.toUpperCase();
      });
    },

    updateAllDisplays() {
      // update color box
      this.colorBox.style.background = `rgba(${this.rgba().join(', ')})`;
      // update number labels
      [...this.colorSliders(), this.aSlider].forEach(slider => {
        slider.nextSibling.innerHTML = slider.value;
      });
    },

    hslToRgb: function (h, s, l) {
      h /= 360, s /= 100, l /= 100;
      var r, g, b;

      if (s == 0) {
        r = g = b = l; // achromatic
      } else {
        var hue2rgb = function hue2rgb(p, q, t) {
          if (t < 0) t += 1;
          if (t > 1) t -= 1;
          if (t < 1 / 6) return p + (q - p) * 6 * t;
          if (t < 1 / 2) return q;
          if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
          return p;
        }
        var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        var p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
      }
      return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
    },

    rgbToHsl: function (r, g, b) {
      r /= 255, g /= 255, b /= 255;
      var max = Math.max(r, g, b), min = Math.min(r, g, b);
      var h, s, l = (max + min) / 2;

      if (max == min) {
        h = s = 0; // achromatic
      } else {
        var d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
          case r: h = (g - b) / d + (g < b ? 6 : 0); break;
          case g: h = (b - r) / d + 2; break;
          case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
      }
      return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
    }

  };

  let actionBuffer = {
    buffer: [],
    maxSize: 3,

    push(item) {
      this.buffer.push(item);
      if (this.buffer.length >= this.maxSize) {
        const p = Promise.resolve(this.unload());
        return p;
      }
      return Promise.resolve(null);
    },

    unload() {
      const temp = this.buffer;
      this.buffer = [];
      return temp;
    }

  }

  function onEvents(targets, events, handler) {
    let len = targets.length;
    if (!len) {
      targets = [targets];
      len = 1;
    }
    for (let i = 0; i < len; i++) {
      events.forEach(event => {
        targets[i][event] = handler;
      });
    };
  };

  function getMousePos(elem, evt) {
    const rect = elem.getBoundingClientRect();
    const zoom = elem.style.zoom || 1;
    return {
      x: Math.round(evt.clientX / zoom - rect.left),
      y: Math.round(evt.clientY / zoom - rect.top)
    };
  };

  onEvents(palette.canvas,
    ['onmousedown', 'onmousemove'],
    function (e) {
      if (e.buttons === 1) { // if left mouse btn is down
        const mousePos = getMousePos(this, e)
        colorPicker.setSlidersWithRgbVals(...palette.getColor(mousePos))
      }
    });

  // Drawing
  container.onmousedown = function (e) {
    if (e.ctrlKey || e.metaKey) { return; } // Don't start drawing if trying to pan
    const mousePos = getMousePos(upper.canvas, e);
    myStroke = new Stroke(upper)
      .setColor(colorPicker.rgba())
      .setSize(size)
      .startAt(mousePos.x, mousePos.y);
    socket.emit('strokeStart', myStroke.getData());
  };

  container.onmousemove = function (e) {
    if (!myStroke || myStroke.finished) { return }
    if (e.buttons !== 1 || (e.ctrlKey || e.metaKey)) {
      myStroke.end().setOn(base);
      myStroke = null;
      socket.emit('strokeEnd');
      return;
    }
    const mousePos = getMousePos(upper.canvas, e);
    myStroke.drawTo(mousePos.x, mousePos.y);
    actionBuffer.push(mousePos).then(unloadedContent => {
      if (unloadedContent) {
        socket.emit('strokeUpdate', unloadedContent);
      }
    })
  };

  onEvents(container,
    ['onmouseup', 'onmouseleave'], () => {
      if (!myStroke || myStroke.finished) { return }
      myStroke.end().setOn(base);
      myStroke = null;
      socket.emit('strokeEnd', actionBuffer.unload());
    }
  );

  // Sliders and buttons
  onEvents(document.getElementsByClassName('colorModeBtn'),
    ['onclick'],
    function () {
      colorPicker.changeMode(this.id);
    }
  )

  onEvents(
    Array.from(document.querySelectorAll('#colorSliders input')),
    ['oninput', 'onchange'],
    () => { colorPicker.updateAllDisplays(); }
  )

  onEvents(document.getElementById('sizeSlider'),
    ['oninput', 'onchange'],
    function handleResize() { size = this.value; });

  onEvents(document.getElementById('zoomSlider'),
    ['oninput', 'onchange'],
    function handleZoom() {
      const zoom = this.value / 100;
      const originalWidth = 1820;
      const originalHeight = 1024;
      if (!container || !container.children) { return };
      container.style.width = "" + originalWidth * zoom + "px";
      container.style.height = "" + originalHeight * zoom + "px";
      const len = container.children.length;
      for (let i = 0; i < len; i++) {
        container.children[i].style.zoom = zoom;
      }
    });

  // SOCKETS

  // When another user joins, generate another canvas that overlays the base
  // and give back the canvas context
  function generateNewCtx(baseCtx, id) {
    const baseCanvas = baseCtx.canvas;
    const newCanvas = baseCanvas.cloneNode();
    newCanvas.id = id;
    newCanvas.style.zoom = baseCanvas.style.zoom;
    if (container) { container.appendChild(newCanvas) };
    return newCanvas.getContext('2d');
  };

  // Upon joining, get the current list of users and generate canvases for them
  socket.on('otherUsers', (userDict) => {
    Object.entries(userDict).forEach(([id, user]) => {
      user.ctx = generateNewCtx(base, id)
      user.stroke = null;
      ctxDict[id] = user;
    });
  });

  socket.on('userJoined', ({ id }) => {
    const ctx = generateNewCtx(upper, id);
    ctxDict[id] = { username: "Guest", ctx: ctx, stroke: null };
  })

  socket.on('userDisconnected', ({ id }) => {
    const canvas = document.getElementById(id);
    if (canvas) { canvas.remove() };
    delete ctxDict[id];
  })

  socket.on('otherStrokeStart', ({ id, strokeData: { rgba, size, x, y } }) => {
    const otherGuy = ctxDict[id];
    otherGuy.stroke = new Stroke(otherGuy.ctx)
      .setColor(rgba)
      .setSize(size)
      .startAt(x[0], y[0]);
  });

  socket.on('otherStrokeUpdate', ({ id, newPoints }) => {
    const len = newPoints.length;
    const stroke = ctxDict[id].stroke;
    for (let i = 0; i < len; i++) {
      const { x, y } = newPoints[i];
      stroke.drawTo(x, y)
    }
  });

  socket.on('otherStrokeEnd', ({ id, newPoints }) => {
    const len = newPoints.length;
    const stroke = ctxDict[id].stroke;
    for (let i = 0; i < len; i++) {
      const { x, y } = newPoints[i];
      stroke.drawTo(x, y)
    }
    stroke.end().setOn(base);
    ctxDict[id].stroke = null;
  });

  socket.on('canvasShareRequest', () => {
    socket.emit('canvasShare', { dataURI: lower.toDataURL('image/png', 0.7) });
  });

  socket.on('canvasData', ({ data }) => {
    const img = new Image();
    const { width, height } = base.canvas
    img.src = data;
    img.onload = function () {
      base.clearRect(0, 0, width, height);
      base.drawImage(this, 0, 0, width, height);
    };
  });

})();