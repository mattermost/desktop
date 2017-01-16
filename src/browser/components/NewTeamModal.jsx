const React = require('react');
const {Modal, Button, FormGroup, FormControl, ControlLabel, HelpBlock} = require('react-bootstrap');
const validUrl = require('valid-url');

class NewTeamModal extends React.Component {

  constructor() {
    super();
    this.state = {
      teamName: '',
      teamUrl: ''
    };
  }

  shouldComponentUpdate() {
    return true;
  }

  getTeamNameValidationState() {
    return this.state.teamName.length > 0 ? '' : 'error';
  }

  handleTeamNameChange(e) {
    this.setState({
      teamName: e.target.value
    });
  }

  getTeamUrlValidationState() {
    if (this.state.teamUrl.length === 0) {
      return 'error';
    }
    if (!validUrl.isUri(this.state.teamUrl)) {
      return 'error';
    }
    return '';
  }

  handleTeamUrlChange(e) {
    this.setState({
      teamUrl: e.target.value
    });
  }

  validateForm() {
    return this.getTeamNameValidationState() === '' &&
           this.getTeamUrlValidationState() === '';
  }

  render() {
    return (
      <Modal.Dialog>
        <Modal.Header>
          <Modal.Title>{'Add a new Team'}</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {'Please specify a server name and a valid Mattermost URL'}
          <form>
            <FormGroup
              validationState={this.getTeamNameValidationState()}
            >
              <ControlLabel>{'Server Display Name'}</ControlLabel>
              <FormControl
                type='text'
                value={this.state.teamName}
                placeholder='Server Name'
                onChange={this.handleTeamNameChange.bind(this)}
              />
              <FormControl.Feedback/>
              <HelpBlock>{'The name of the server displayed on your desktop app tab bar.'}</HelpBlock>
            </FormGroup>
            <FormGroup
              validationState={this.getTeamUrlValidationState()}
            >
              <ControlLabel>{'Team URL'}</ControlLabel>
              <FormControl
                type='text'
                value={this.state.teamUrl}
                placeholder='https://example.org'
                onChange={this.handleTeamUrlChange.bind(this)}
              />
              <FormControl.Feedback/>
              <HelpBlock>{'The URL of your Mattermost server. Must start with http:// or https://.'}</HelpBlock>
            </FormGroup>
          </form>
        </Modal.Body>

        <Modal.Footer>
          <Button
            onClick={this.props.onClose}
          >{'Cancel'}</Button>
          <Button
            onClick={() => {
              this.props.onSave({
                url: this.state.teamUrl,
                name: this.state.teamName
              });
            }}
            disabled={!this.validateForm()}
            bsStyle='primary'
          >{'Add'}</Button>
        </Modal.Footer>

      </Modal.Dialog>
    );
  }
}

NewTeamModal.propTypes = {
  onClose: React.PropTypes.func,
  onSave: React.PropTypes.func
};

module.exports = NewTeamModal;
