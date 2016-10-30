// ErrorCode: https://code.google.com/p/chromium/codesearch#chromium/src/net/base/net_error_list.h

const React = require('react');
const {Grid, Row, Col} = require('react-bootstrap');

const errorPage = {
  tableStyle: {
    display: 'table',
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: '0',
    left: '0'
  },

  cellStyle: {
    display: 'table-cell',
    verticalAlign: 'top',
    paddingTop: '2em'
  },

  bullets: {
    paddingLeft: '15px',
    lineHeight: '1.7'
  },

  techInfo: {
    fontSize: '12px',
    color: '#aaa'
  }
};

class ErrorView extends React.Component {
  render() {
    return (
      <Grid
        id={this.props.id}
        style={this.props.style}
      >
        <div style={errorPage.tableStyle}>
          <div style={errorPage.cellStyle}>
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
                <ul style={errorPage.bullets}>
                  <li>{'Your computer is connected to the internet.'}</li>
                  <li>{'The Mattermost URL '}
                    <a href={this.props.errorInfo.validatedURL}>
                      {this.props.errorInfo.validatedURL}
                    </a>{' is correct.'}</li>
                  <li>{'You can reach '}
                    <a href={this.props.errorInfo.validatedURL}>
                      {this.props.errorInfo.validatedURL}
                    </a>{' from a browser window.'}</li>
                </ul>
                <br/>
                <div style={errorPage.techInfo}>
                  {this.props.errorInfo.errorDescription}{' ('}
                  {this.props.errorInfo.errorCode }{')'}</div>
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
}

ErrorView.propTypes = {
  errorInfo: React.PropTypes.object,
  id: React.PropTypes.number,
  style: React.PropTypes.object
};

module.exports = ErrorView;
