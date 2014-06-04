chrome.app.runtime.onLaunched.addListener(function() {
    chrome.app.window.create('main.html', {
        'bounds': {
            'width': 1280,
            'height': 800
        },
        'minWidth': 400,
        'minHeight': 700
    });
});
