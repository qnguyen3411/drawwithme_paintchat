$(document).ready(() => {

  let lower = $('#lower').get(0).getContext('2d');
  let upper = $('#upper').get(0).getContext('2d');
  const originalSize = { width: 1820, height: 1024 }
  let dragging = false;
  let myStroke;
  let size = 1;
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
        newVals = colorTransform(...this.sliderVals());
        this.setSliders(...newVals);
        this.mode = mode;
        this.updateSliderRange();
        this.updateSliderLabels();
        this.updateSliderValLabels();
      }
    },

    cssString: function (withAlpha = true) {
      let colorVal = this.sliderVals()
      colorVal.push((withAlpha) ? this.alphaVal() : 1)
      if (this.mode == 'hsla') {
        colorVal[1] += "%"
        colorVal[2] += "%"
      }
      const colorStr = colorVal.join(', ')
      return `${this.mode}(${colorStr})`
    },

    sliderVals: function () {
      return [
        $(this.slider1).val(),
        $(this.slider2).val(),
        $(this.slider3).val(),
      ]
    },

    alphaVal: function () {
      return $(this.aSlider).val() / 100
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
      $(this.slider1).val(val1)
      $(this.slider2).val(val2)
      $(this.slider3).val(val3)
      this.updateColorBox()
    },

    setSlidersWithRgbVals: function (val1, val2, val3) {
      if (this.mode == 'rgba') {
        this.setSliders(val1, val2, val3);
      } else {
        const hsl = this.rgbToHsl(val1, val2, val3);
        this.setSliders(...hsl);
      }
      this.updateAllDisplays()
    },

    updateColorBox() {
      $(this.colorBox).css('background-color', this.cssString(withAlpha = false))
    },

    updateSliderRange() {
      const bounds = (this.mode == 'rgba') ? [255, 255, 255] : [360, 100, 100];
      bounds.map((maxVal, index) => {
        const thisSlider = this[`slider${index + 1}`]
        $(thisSlider).attr('max', maxVal)
      })
    },

    updateSliderLabels() {
      this.mode.split("").forEach((char, index) => {
        $(`#slider${index + 1}Label`).html(char.toUpperCase())
      })
    },
    updateSliderValLabels() {
      [this.slider1, this.slider2, this.slider3, this.aSlider].forEach(slider => {
        $(slider).siblings('.sliderVal').html($(slider).val());
      })
    },

    updateAllDisplays() {
      this.updateColorBox();
      this.updateSliderLabels();
      this.updateSliderValLabels();
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

  $('#palette').mousedown(function (e) {
    const mousePos = getMousePos(palette.canvas, e, true)
    colorPicker.setSlidersWithRgbVals(...palette.getColor(mousePos))
    dragging = true;
  }).mousemove(function (e) {
    if (dragging) {
      const mousePos = getMousePos(palette.canvas, e, true)
      colorPicker.setSlidersWithRgbVals(...palette.getColor(mousePos))
    }
  }).mouseup(function () {
    dragging = false;
  }).mouseleave(function() {
    dragging = false;
  })


  $('#upper').mousedown(function (e) {
    if (!e.ctrlKey && !e.metaKey) {
      const mousePos = getMousePos(upper.canvas, e)
      myStroke = new Stroke(upper, lower);
      myStroke.getBrushSettings(colorPicker.rgba(), size);
      myStroke.start(mousePos.x, mousePos.y)
      dragging = true
    }
  });

  $('#upper').mousemove(function (e) {
    if (dragging) {
      const mousePos = getMousePos(upper.canvas, e)
      myStroke.update(mousePos.x, mousePos.y);
    }
  });

  $('#upper').mouseup(function (e) {
    if(dragging) {
      myStroke.end();
      dragging = false;
    }
  });


  $('#slider1, #slider2, #slider3, #slider4').on("input change", function () {
    colorPicker.updateColorBox();
    colorPicker.updateSliderValLabels();
  })

  $('.colorModeBtn').click(function () {
    colorPicker.changeMode($(this).attr('mode'))
  })


  function getMousePos(canvas, evt, zoomed=true) {
    const rect = canvas.getBoundingClientRect();
    const zoom = (zoomed) ? $(canvas).css('zoom') : 1;
    return {
      x: evt.clientX / zoom - rect.left,
      y: evt.clientY / zoom - rect.top
    };
  }

  $('#sizeSlider').on("input change", function() {
    const val = $(this).val()
    $('#sizeSliderLabel').html(`Size: ${val}`)
    size = val;
  })

  $('#zoomSlider').on("input change", function() {
    const val = $(this).val()
    $('#zoomSliderLabel').html(`Zoom: ${val}%`)
    handleZoom(val);
  })

  function handleZoom(zoomVal) {
    $('#canvasContainer').width(originalSize.width * zoomVal / 100)
    $('#canvasContainer').height(originalSize.height * zoomVal / 100)
    $('#upper, #lower').css('zoom', `${zoomVal}%`)
  }
});