'use strict';

var MainPage = React.createClass({
  render: function() {
    var style = {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0
    };
    // 'disablewebsecurity' is necessary to display external images.
    // However, it allows also CSS/JavaScript.
    // So webview should use 'allowDisplayingInsecureContent' as same as BrowserWindow.
    return (
      <webview style={ style } id="mainWebview" autosize="on" preload="webview/mattermost.js"></webview>
      );
  }
});


ReactDOM.render(
  <MainPage />,
  document.getElementById('content')
);
