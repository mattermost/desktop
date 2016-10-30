const React = require('react');
const ReactDOM = require('react-dom');
const {Button, Col, ControlLabel, Form, FormGroup, FormControl, Modal} = require('react-bootstrap');

class LoginModal extends React.Component {
  handleSubmit(event) {
    event.preventDefault();
    const usernameNode = ReactDOM.findDOMNode(this.refs.username);
    const passwordNode = ReactDOM.findDOMNode(this.refs.password);
    this.props.onLogin(this.props.request, usernameNode.value, passwordNode.value);
    usernameNode.value = '';
    passwordNode.value = '';
  }

  render() {
    var theServer = '';
    if (!this.props.show) {
      theServer = '';
    } else if (this.props.authInfo.isProxy) {
      theServer = `The proxy ${this.props.authInfo.host}:${this.props.authInfo.port}`;
    } else {
      theServer = `The server ${this.props.authServerURL}`;
    }
    const message = `${theServer} requires a username and password.`;
    return (
      <Modal show={this.props.show}>
        <Modal.Header>
          <Modal.Title>{'Authentication Required'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            { message }
          </p>
          <Form
            horizontal={true}
            onSubmit={this.handleSubmit}
          >
            <FormGroup>
              <Col
                componentClass={ControlLabel}
                sm={2}
              >{'User Name'}</Col>
              <Col sm={10}>
                <FormControl
                  type='text'
                  placeholder='User Name'
                  ref='username'
                />
              </Col>
            </FormGroup>
            <FormGroup>
              <Col
                componentClass={ControlLabel}
                sm={2}
              >{'Password'}</Col>
              <Col sm={10}>
                <FormControl
                  type='password'
                  placeholder='Password'
                  ref='password'
                />
              </Col>
            </FormGroup>
            <FormGroup>
              <Col sm={12}>
                <div className='pull-right'>
                  <Button
                    type='submit'
                    bsStyle='primary'
                  >{'Login'}</Button>
                  { ' ' }
                  <Button onClick={this.props.onCancel}>{'Cancel'}</Button>
                </div>
              </Col>
            </FormGroup>
          </Form>
        </Modal.Body>
      </Modal>
    );
  }
}

LoginModal.propTypes = {
  authInfo: React.PropTypes.object,
  authServerURL: React.PropTypes.string,
  onCancel: React.PropTypes.func,
  onLogin: React.PropTypes.func,
  request: React.PropTypes.object,
  show: React.PropTypes.bool
};

module.exports = LoginModal;
