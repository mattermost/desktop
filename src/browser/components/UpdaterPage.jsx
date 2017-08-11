const React = require('react');
const propTypes = require('prop-types');
const {Button, Navbar} = require('react-bootstrap');

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
          <Button
            bsStyle='primary'
            onClick={props.onClickInstall}
          >{'Install Update'}</Button>
        </div>
      </Navbar>
    </div>
  );
}

UpdaterPage.propTypes = {
  onClickInstall: propTypes.func.isRequired,
  onClickReleaseNotes: propTypes.func.isRequired,
  onClickRemind: propTypes.func.isRequired,
  onClickSkip: propTypes.func.isRequired
};

module.exports = UpdaterPage;
