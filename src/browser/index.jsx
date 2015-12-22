'use strict';

const Grid = ReactBootstrap.Grid;
const Row = ReactBootstrap.Row;
const Col = ReactBootstrap.Col;
const Tabs = ReactBootstrap.Tabs;
const Tab = ReactBootstrap.Tab;

const electron = require('electron');
const remote = electron.remote;

const settings = require('../common/settings');

var MainPage = React.createClass({
  getInitialState: function() {
    return {
      key: 0
    };
  },
  handleSelect: function(key) {
    this.setState({
      key
    });
  },
  visibleStyle: function(visible) {
    var visibility = visible ? 'initial' : 'hidden';
    return {
      position: 'absolute',
      top: 42,
      right: 0,
      bottom: 0,
      left: 0,
      visibility: visibility
    };
  },
  render: function() {
    var tabs = this.props.teams.map(function(team, index) {
      return (<Tab eventKey={ index } title={ team.name }></Tab>);
    });
    var thisObj = this;
    var views = this.props.teams.map(function(team, index) {
      return (<MattermostView style={ thisObj.visibleStyle(thisObj.state.key === index) } src={ team.url } />)
    });
    return (
      <Grid fluid>
        <Row>
          <Tabs activeKey={ this.state.key } onSelect={ this.handleSelect }>
            { tabs }
          </Tabs>
        </Row>
        <Row>
          { views }
        </Row>
      </Grid>
      );
  }
});

var MattermostView = React.createClass({
  render: function() {
    // 'disablewebsecurity' is necessary to display external images.
    // However, it allows also CSS/JavaScript.
    // So webview should use 'allowDisplayingInsecureContent' as same as BrowserWindow.
    return (
      <webview style={ this.props.style } preload="webview/mattermost.js" src={ this.props.src } allowpopups></webview>
      );
  }
});

var configFile = remote.getGlobal('config-file');
var config = settings.readFileSync(configFile);

ReactDOM.render(
  <MainPage teams={ config.teams } />,
  document.getElementById('content')
);
