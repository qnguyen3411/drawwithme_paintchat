$(document).ready(() => {
  let socket = io();
  let ctxDict = {}

  let base = $('#lower').get(0).getContext('2d');
  let upper = $('#upper').get(0).getContext('2d');
  let myStroke;
  let isPenDown = false;
  let size = 1;
  let zoom = 1;
  let palette = new Palette($('#palette canvas').get(0), 'palette.png')
  PanModule.setPannable($('#canvasWindow').get(0));

  let colorPicker = {
    slider1: $('#slider1').get(0),
    slider2: $('#slider2').get(0),
    slider3: $('#slider3').get(0),
    aSlider: $('#slider4').get(0),
    colorBox: $('#colorBox').get(0),

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

    colorSliders: function() {
      return [this.slider1, this.slider2, this.slider3];
    },

    sliderVals: function () {
      return this.colorSliders().map(sl => sl.value);
    },

    alphaVal: function () {
      return this.aSlider.value / 100;
    },

    rgba: function() {
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
      $(this.slider3).val(val3).trigger('change');
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
        $(thisSlider).attr('max', maxVal)
      })
    },

    updateSliderNames(mode) {
      mode.split("").forEach((char, index) => {
        $(`#slider${index + 1}Label`).html(char.toUpperCase())
      });
    },

    updateAllDisplays() {
      // update color box
      $(this.colorBox).css(
        'background-color', `rgba(${this.rgba().join(', ')})`);
      // update number labels
      [...this.colorSliders(), this.aSlider].forEach(slider => {
        $(slider).siblings('.sliderVal').html($(slider).val());
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

  }

  function getMousePos(canvas, evt, zoom) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.round(evt.clientX / zoom - rect.left),
      y: Math.round(evt.clientY / zoom - rect.top)
    };
  }

  $('#palette').on('mousedown mousemove', function(e) {
    if (e.buttons == 1) { // if left mouse btn is down
      const mousePos = getMousePos(palette.canvas, e, zoom)
      colorPicker.setSlidersWithRgbVals(...palette.getColor(mousePos))
    }
  })
  // Drawing
  $('#canvasContainer').mousedown(function (e) {
    if (e.ctrlKey || e.metaKey) { return; } // Don't start drawing if trying to pan
    const mousePos = getMousePos(upper.canvas, e, zoom);
    myStroke = new Stroke(upper, base)
      .setBrush(colorPicker.rgba(), size)
      .start(mousePos.x, mousePos.y);
    socket.emit('strokeStart', myStroke.getData()),
    isPenDown = true;
  })
  .mousemove(function (e) {
    if (!isPenDown) { return; }
    const mousePos = getMousePos(upper.canvas, e, zoom);
    myStroke.update(mousePos.x, mousePos.y);
    socket.emit('strokeUpdate', mousePos)
  })
  .on('mouseup mouseleave',() => {
    if (!isPenDown) { return; }
    isPenDown = false;
    myStroke.end();
    socket.emit('strokeEnd')
  });

  // Sliders and buttons
  $('.colorModeBtn').click(function () {
    colorPicker.changeMode($(this).attr('mode'))
  })
  
  $("#colorSliders input").on("input change", function () {
    colorPicker.updateAllDisplays();
  })

  $('#sizeSlider').on("input change", function() {
    size = this.value;
  })

  $('#zoomSlider').on("input change", function() {
    zoom = this.value / 100;
    const originalSize = { width: 1820, height: 1024 }
    $('#canvasContainer')
    .width(originalSize.width * zoom )
    .height(originalSize.height * zoom)
    .children().css('zoom', zoom);
  })


  // Socket functionalities
  function generateNewCtx(id) {
    return  $(upper.canvas).clone()
      .attr('id', `${id}`)
      .css('zoom', $('#lower').css('zoom'))
      .appendTo('#canvasContainer')
      .get(0).getContext('2d');
  }

  socket.on('otherUsers', (userDict) => {
    Object.entries(userDict).forEach(([id, user]) => {
      user.ctx = generateNewCtx(id)
      ctxDict[id] = user 
    })
  })

  socket.on('userJoined', ({id}) => {
    console.log("USER JOINED")
    const ctx = generateNewCtx(id)
    ctxDict[id] = {username:"Guest" ,ctx: ctx, stroke: null}
  })

  socket.on('userDisconnected', ({id}) => {
    $(`#${id}`).remove();
    delete ctxDict[id]
  })

  socket.on('otherStrokeStart', ({id, strokeData: {rgba, size, x, y}}) => {
    const otherGuy = ctxDict[id];
    otherGuy.stroke = new Stroke(otherGuy.ctx, base)
      .setBrush(rgba, size)
      .start(x[0], y[0]);
  })

  socket.on('otherStrokeUpdate', ({id, newPoint: {x, y} }) => {
    ctxDict[id].stroke.update(x, y)
  })

  socket.on('otherStrokeEnd', ({id}) => {
    ctxDict[id].stroke.end()
  })

  socket.on('canvasShareRequest', () => {
    socket.emit('canvasShare', {dataURI: lower.toDataURL('image/png', 0.5)});
  })

  socket.on('canvasData', ({data}) => {
    // console.log("GOTTEM")
    // console.log(data)
    const img = new Image();
    img.src = data;
    img.onload = function() {
      base.drawImage( this, 0, 0, base.canvas.width, base.canvas.height )
    }
  })

});