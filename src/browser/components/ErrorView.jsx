// ErrorCode: https://code.google.com/p/chromium/codesearch#chromium/src/net/base/net_error_list.h

const React = require('react');
const PropTypes = require('prop-types');
const {Grid, Row, Col} = require('react-bootstrap');
const {shell} = require('electron');

function ErrorView(props) {
  const classNames = ['container', 'ErrorView'];
  if (!props.active) {
    classNames.push('ErrorView-hidden');
  }
  if (props.withTab) {
    classNames.push('ErrorView-with-tab');
  }
  function handleClick(event) {
    event.preventDefault();
    shell.openExternal(props.errorInfo.validatedURL);
  }
  return (
    <Grid
      id={props.id}
      bsClass={classNames.join(' ')}
    >
      <div className='ErrorView-table'>
        <div className='ErrorView-cell'>
          <Row>
            <Col
              xs={0}
              sm={1}
              md={1}
              lg={2}
            />
            <Col
              xs={12}
              sm={10}
              md={10}
              lg={8}
            >
              <h2>{'Cannot connect to Mattermost'}</h2>
              <hr/>
              <p>{'We\'re having trouble connecting to Mattermost. If refreshing this page (Ctrl+R or Command+R) does not work please verify that:'}</p>
              <br/>
              <ul className='ErrorView-bullets' >
                <li>{'Your computer is connected to the internet.'}</li>
                <li>{'The Mattermost URL '}
                  <a
                    onClick={handleClick}
                    href={props.errorInfo.validatedURL}
                  >
                    {props.errorInfo.validatedURL}
                  </a>{' is correct.'}</li>
                <li>{'You can reach '}
                  <a
                    onClick={handleClick}
                    href={props.errorInfo.validatedURL}
                  >
                    {props.errorInfo.validatedURL}
                  </a>{' from a browser window.'}</li>
              </ul>
              <br/>
              <div className='ErrorView-techInfo'>
                {props.errorInfo.errorDescription}{' ('}
                {props.errorInfo.errorCode }{')'}</div>
            </Col>
            <Col
              xs={0}
              sm={1}
              md={1}
              lg={2}
            />
          </Row>
        </div>
      </div>
    </Grid>
  );
}

ErrorView.propTypes = {
  errorInfo: PropTypes.object,
  id: PropTypes.number,
  active: PropTypes.bool,
  withTab: PropTypes.bool
};

module.exports = ErrorView;
