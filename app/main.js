$("document").ready(function() {
    var isGenerating = false;
    var renderCanceled = false;

    var isChanged = true;
    function changed() { isChanged = true; }

    var sizex = 0;
    var sizey = 0;

    function generate(inkscapeFix, opaque, callback) {
        isGenerating = true;
        renderCanceled = false;
        isChanged = false;

        var img = document.getElementById('sourceImg');

        var xSamples = Number($('#xSamples').val());
        var ySamples = Number($('#ySamples').val());
        var xScale = Number($('#xScale').val());
        var yScale = Number($('#yScale').val());

        var font = $('#font').val();
        var fontScale = Number($('#fontScale').val());
        var bold = false;
        if ($('#bold').is(':checked'))
            bold = true;
        var chars = $('#letters').val();
        var sequential = $('#letterOrderSequential').is(':checked');

        var fontSizeShift = Number($('#fontSizeShift').val());
        var isVarying = $('#lumFontSize').is(':checked');
        var isVaryingInverted = $('#lumFontSizeInvert').is(':checked');

        var overrideSize = false;
        var outputWidth = $('#outputWidth').val();
        if (outputWidth != 'auto') {
            outputWidth = Number(outputWidth);
            if (outputWidth > 0)
                overrideSize = true;
        }

        if (!isVarying)
            fontSizeShift = 0;

        console.log(xSamples);
        console.log(ySamples);
        console.log(xScale);
        console.log(yScale);

        var output = $('#output');
        output.html('');

        console.log(output.width());
        console.log(output.height());

        var canvas = document.getElementById('canvas');
        canvas.width = xSamples;
        canvas.height = ySamples;

        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, xSamples, ySamples);

        var imageData = ctx.getImageData(0, 0, xSamples, ySamples);
        console.log(imageData);
        var d = imageData.data;

        function toSize(x, y, max, shift, invert) {
            var i = (y * xSamples + x) * 4;
            var r = (256 - (d[i] + d[i+1] + d[i+2]) / 4) / 256;
            return Math.max(0, max * (shift + (invert ? r : 1 - r)));
        }

        function toHex(d) {
            var x = d.toString(16);
            if (x.length == 1)
                x = '0' + x;
            return x;
        }

        function toColor(x, y) {
            var i = (y * xSamples + x) * 4;
            var color = '#' + toHex(d[i]) + toHex(d[i+1]) + toHex(d[i+2]);
            return color;
        }

        var dx = output.width() / (xScale * (xSamples + 5));
        var dy = output.height() / (yScale * (ySamples + 5));
        var dt = 0;
        console.log("DX: " + dx + " DY: " + dy);

        var editorRatio = output.width() / output.height();
        var outputRatio = xScale * xSamples / (yScale * ySamples);

        if (overrideSize) {
            dt = outputWidth / (xScale * (xSamples + fontScale + fontSizeShift));
        } else if (editorRatio > outputRatio) {
            dt = dy;
        } else {
            dt = dx;
        }
        sizex = Math.floor(xScale * dt * (xSamples + fontScale + fontSizeShift));
        sizey = Math.floor(yScale * dt * (ySamples + fontScale + fontSizeShift));

        var xOffset = fontSizeShift * dt;
        var yOffset = fontSizeShift * dt;

        var charPos = 0;
        function nextChar() {
            var char = chars[charPos];
            charPos++;
            if (charPos >= chars.length)
                charPos = 0;
            return char;
        }
        function randomChar() {
            return chars[Math.floor(chars.length * Math.random())];
        }
        var draw = SVG('output').size(sizex, sizey);
        $('#outputDimension').html(sizex + ' &times; ' + sizey);
        if (opaque) {
            draw.rect(sizex, sizey).attr('fill', $('#bg').val());
        }

        function processRow(y) {
            for (var x = 0; x < xSamples; ++x) {
                var char = sequential ? nextChar() : randomChar();
                if (char == ' ') continue;
                var size = isVarying ? toSize(x, y, dt * fontScale * 1.25, fontSizeShift, isVaryingInverted) : dt * fontScale;
                var yPos = yScale * dt * (y + (inkscapeFix ? 1 : 0.25) * fontScale) + (inkscapeFix ? -1 : 1) * (dt * yScale - size) / (inkscapeFix ? 2 : 1);
                var text = draw.text(char).move(xScale * dt * x + dt * 0.75 * fontScale + xOffset, yPos + yOffset);
                text.attr('fill', toColor(x, y));
                text.attr('font-family', font);
                text.attr('text-anchor', 'middle');
                if (bold) {
                    text.attr('font-weight', 'bold');
                }
                text.attr('font-size', size + 'px');
                text.attr('dominant-baseline', 'hanging');
            }
        }
        function finish() {
            isGenerating = false;
            $('#loading').hide();
            if (callback !== undefined) {
                callback();
            }
        }
        var y = 0;
        function resume() {
            if (renderCanceled) {
                finish();
                return;
            }
            processRow(y);
            ++y;
            if (y < ySamples) {
                setTimeout(resume, 10);
            } else {
                finish();
            }
        }
        resume();
    }

    var img = document.getElementById('sourceImg');
    img.onload = reloadedImage;

    function reloadedImage() {
        var ratio = img.width / img.height;
        $('#xSamples').val(ratio > 1 ? 32 : Math.floor(32 * ratio));
        $('#ySamples').val(ratio > 1 ? Math.floor(32 / ratio) : 32);
        queueGenerate();
    }

    var generateTimeout = null;
    function queueGenerate() {
        if (isGenerating)
            return;
        $('#loading').show();
        if (generateTimeout != null) {
            clearTimeout(generateTimeout);
        }
        generateTimeout = setTimeout(function() {
            generateTimeout = null;
            generate(false, true);
        }, 200);
    }
    function cancelRender() {
        renderCanceled = true;
    }

    function load(imageFile) {
        console.log(imageFile);
        img.src = imageFile;
    }

    function errorHandler(e) {
        console.log(e);
    };

    function performSave() {
        chrome.fileSystem.chooseEntry(
            {type: 'saveFile', accepts: [ {extensions: ['svg','xml']} ] },
            function (writableEntry) {
                writableEntry.createWriter(function (writer) {
                    var data = '<?xml version="1.0" standalone="no"?>\n' +
                        '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n' +
                        $('#output').html();

                    writer.onerror = errorHandler;
                    writer.onwriteend = function(e) {
                        console.log("Write complete");
                    };
                    writer.write(new Blob([data], {type: 'text/plain'}));
                }, errorHandler);
            });
    }

    function performSavePNG() {
        var canvas = document.getElementById("canvas");
        canvas.width = sizex;
        canvas.height = sizey;

        var img = new Image();
        img.src = "data:image/svg+xml;base64," + btoa($('#output').html());
        img.onload = function() {
            var ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, sizex, sizey);

            var data = canvas.toDataURL('image/png');

            $('#present').show();
            var webview = document.getElementById("view");
            webview.src = data;
        }
    }

    function loadImage() {
        chrome.fileSystem.chooseEntry({type: 'openFile', accepts: [ {mimeTypes: ['image/*']} ] }, function(readOnlyEntry) {
            $('#loading').show();
            readOnlyEntry.file(function(file) {
                var reader = new FileReader();
                reader.onerror = errorHandler;
                reader.onloadend = function() {
                    var binary = '';
                    var bytes = new Uint8Array(reader.result);
                    var len = bytes.byteLength;
                    for (var i = 0; i < len; i++) {
                        binary += String.fromCharCode( bytes[ i ] )
                    }
                    var base64 = window.btoa(binary);
                    load('data:' + file.type + ';base64,' + base64);
                };
                reader.readAsArrayBuffer(file);
            });
        });
    }

    function saveToSVG() {
        if (isGenerating)
            return;

        var fix = $('#inkscapeFix').is(':checked');
        var opaque = $('#opaque').is(':checked');

        if (fix || !opaque || isChanged) {
            $('#loading').show();
            generate(fix, opaque, performSave);
            isChanged = true;
        } else {
            performSave();
        }
    }

    function saveToPNG() {
        if (isGenerating)
            return;

        var opaque = $('#opaque').is(':checked');

        if (!opaque || isChanged) {
            $('#loading').show();
            generate(false, opaque, performSavePNG);
            isChanged = !opaque;
        } else {
            performSavePNG();
        }
    }

    $('#load').bind('click', function() {
        if (!isGenerating)
            loadImage();
        return false;
    });
    $('#save').bind('click', function() {
        saveToSVG();
        return false;
    });
    $('#savePng').bind('click', function() {
        saveToPNG();
        return false;
    });
    $('#generate').bind('click', function() {
        queueGenerate();
        return false;
    });
    $('#cancelRender').bind('click', function() {
        cancelRender();
        return false;
    });
    function fontPreview() {
        $('#fontPreview').css('font-family', $('#font').val());
        $('#fontPreview').css('font-weight', $('#bold').is(':checked') ? 'bold' : 'normal');
    }
    $('#font').bind('change', fontPreview);
    $('#font').bind('keyup', fontPreview);
    $('#bold').bind('change', fontPreview);
    fontPreview();

    $('input[type=text]').bind('change', changed);
    $('input[type=checkbox]').bind('change', changed);

    $('.button').button();
    $('#accordion').accordion({ header: 'h3' });
    $('#closePresent').bind('click', function () { $('#present').hide(); return false; });
    $('#present').hide();

    setTimeout(function() {
        load('sample.jpg');
    }, 500);
});
