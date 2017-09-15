const React = require('react');
const propTypes = require('prop-types');
const {Button, Navbar} = require('react-bootstrap');

function InstallButton(props) {
  if (props.notifyOnly) {
    return (<Button
      bsStyle='primary'
      onClick={props.onClickDownload}
            >{'Download Update'}</Button>);
  }
  return (<Button
    bsStyle='primary'
    onClick={props.onClickInstall}
          >{'Install Update'}</Button>);
}

InstallButton.propTypes = {
  notifyOnly: propTypes.bool.isRequired,
  onClickInstall: propTypes.func.isRequired,
  onClickDownload: propTypes.func.isRequired
};

function UpdaterPage(props) {
  return (
    <div>
      <Navbar>
        <h1 className='UpdaterPage-heading'>{'New update is available'}</h1>
      </Navbar>
      <div className='container-fluid'>
        <p>{'A new version of the Mattermost Desktop App is available!'}</p>
        <p>{'Read the '}
          <a
            href='#'
            onClick={props.onClickReleaseNotes}
          >{'release notes'}</a>
          {' to learn more.'}
        </p>
      </div>
      <Navbar
        className='UpdaterPage-footer'
        fixedBottom={true}
        fluid={true}
      >
        <Button
          className='UpdaterPage-skipButton'
          bsStyle='link'
          onClick={props.onClickSkip}
        >{'Skip this version'}</Button>
        <div className='pull-right'>
          <Button
            bsStyle='link'
            onClick={props.onClickRemind}
          >{'Remind me in 2 days'}</Button>
          <InstallButton
            notifyOnly={props.notifyOnly}
            onClickInstall={props.onClickInstall}
            onClickDownload={props.onClickDownload}
          />
        </div>
      </Navbar>
    </div>
  );
}

UpdaterPage.propTypes = {
  notifyOnly: propTypes.bool.isRequired,
  onClickInstall: propTypes.func.isRequired,
  onClickDownload: propTypes.func.isRequired,
  onClickReleaseNotes: propTypes.func.isRequired,
  onClickRemind: propTypes.func.isRequired,
  onClickSkip: propTypes.func.isRequired
};

module.exports = UpdaterPage;
