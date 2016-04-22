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
  handleLogin: function() {
    if (this.props.onLogin) {
      const username = ReactDOM.findDOMNode(this.refs.username).value;
      const password = ReactDOM.findDOMNode(this.refs.password).value;
      this.props.onLogin(this.props.request, username, password);
    }
  },
  render: function() {
    return (
      <Modal show={ this.props.show }>
        <Modal.Header>
          <Modal.Title>Authentication Required</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>The server
            { ' ' + this.props.authServerURL } requires a username and password.</p>
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
                <Button bsStyle="primary" onClick={ this.handleLogin }>Login</Button>
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
