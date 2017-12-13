const React = require('react');
const ReactDOM = require('react-dom');
const propTypes = require('prop-types');
const {ipcRenderer} = require('electron');
const url = require('url');
const UpdaterPage = require('./components/UpdaterPage.jsx');

const thisURL = url.parse(location.href, true);
const notifyOnly = thisURL.query.notifyOnly === 'true';

class UpdaterPageContainer extends React.Component {
  constructor(props) {
    super(props);
    this.state = props.initialState;
  }

  componentDidMount() {
    ipcRenderer.on('start-download', () => {
      this.setState({
        isDownloading: true
      });
    });
    ipcRenderer.on('progress', (event, progress) => {
      this.setState({
        progress
      });
    });
  }

  render() {
    return (
      <UpdaterPage
        notifyOnly={this.props.notifyOnly}
        {...this.state}
        onClickReleaseNotes={() => {
          ipcRenderer.send('click-release-notes');
        }}
        onClickSkip={() => {
          ipcRenderer.send('click-skip');
        }}
        onClickRemind={() => {
          ipcRenderer.send('click-remind');
        }}
        onClickInstall={() => {
          ipcRenderer.send('click-install');
        }}
        onClickDownload={() => {
          ipcRenderer.send('click-download');
        }}
      />
    );
  }
}

UpdaterPageContainer.propTypes = {
  notifyOnly: propTypes.bool,
  initialState: propTypes.object
};

ReactDOM.render(
  <UpdaterPageContainer
    notifyOnly={notifyOnly}
    initialState={{isDownloading: false, progress: 0}}
  />,
  document.getElementById('content')
);
