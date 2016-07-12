const React = require('react');
const ReactDOM = require('react-dom');
const ReactBootstrap = require('react-bootstrap');
const Modal = ReactBootstrap.Modal;
const Form = ReactBootstrap.Form;
const FormGroup = ReactBootstrap.FormGroup;
const FormControl = ReactBootstrap.FormControl;
const ControlLabel = ReactBootstrap.ControlLabel;
const Col = ReactBootstrap.Col;

const Button = ReactBootstrap.Button;

const LoginModal = React.createClass({
  handleSubmit: function(event) {
    event.preventDefault();
    const usernameNode = ReactDOM.findDOMNode(this.refs.username);
    const passwordNode = ReactDOM.findDOMNode(this.refs.password);
    this.props.onLogin(this.props.request, usernameNode.value, passwordNode.value);
    usernameNode.value = '';
    passwordNode.value = '';
  },
  render: function() {
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
      <Modal show={ this.props.show }>
        <Modal.Header>
          <Modal.Title>Authentication Required</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            { message }
          </p>
          <Form horizontal onSubmit={ this.handleSubmit }>
            <FormGroup>
              <Col componentClass={ ControlLabel } sm={ 2 }>User&nbsp;Name</Col>
              <Col sm={ 10 }>
              <FormControl type="text" placeholder="User Name" ref="username" />
              </Col>
            </FormGroup>
            <FormGroup>
              <Col componentClass={ ControlLabel } sm={ 2 }>Password</Col>
              <Col sm={ 10 }>
              <FormControl type="password" placeholder="Password" ref="password" />
              </Col>
            </FormGroup>
            <FormGroup>
              <Col sm={ 12 }>
              <div className="pull-right">
                <Button type="submit" bsStyle="primary">Login</Button>
                { ' ' }
                <Button onClick={ this.props.onCancel }>Cancel</Button>
              </div>
              </Col>
            </FormGroup>
          </Form>
        </Modal.Body>
      </Modal>
      );
  }
});

module.exports = LoginModal;
