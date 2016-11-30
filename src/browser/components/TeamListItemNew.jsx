const React = require('react');
const {findDOMNode} = require('react-dom');
const {Button, HelpBlock, ListGroupItem} = require('react-bootstrap');

const TeamListItemNew = React.createClass({
  propTypes: {
    onTeamAdd: React.PropTypes.func,
    teamIndex: React.PropTypes.number,
    teamName: React.PropTypes.string,
    teamUrl: React.PropTypes.string
  },

  getInitialState() {
    return {
      name: this.props.teamName,
      url: this.props.teamUrl,
      index: this.props.teamIndex,
      errorMessage: null
    };
  },
  handleSubmit(e) {
    console.log('submit');
    e.preventDefault();
    const errorMessage = this.getValidationErrorMessage();
    if (errorMessage) {
      this.setState({
        errorMessage
      });
      return;
    }

    this.props.onTeamAdd({
      name: this.state.name.trim(),
      url: this.state.url.trim(),
      index: this.state.index
    });

    this.setState({
      name: '',
      url: '',
      index: '',
      errorMessage: null
    });
  },
  handleNameChange(e) {
    console.log('name');
    this.setState({
      name: e.target.value
    });
  },
  handleURLChange(e) {
    console.log('url');
    this.setState({
      url: e.target.value
    });
  },

  getValidationErrorMessage() {
    if (this.state.name.trim() === '') {
      return 'Name is required.';
    } else if (this.state.url.trim() === '') {
      return 'URL is required.';
    } else if (!(/^https?:\/\/.*/).test(this.state.url.trim())) {
      return 'URL should start with http:// or https://.';
    }
    return null;
  },

  componentDidMount() {
    const inputTeamName = findDOMNode(this.refs.inputTeamName);
    const setErrorMessage = () => {
      this.setState({
        errorMessage: this.getValidationErrorMessage()
      });
    };
    inputTeamName.addEventListener('invalid', setErrorMessage);
    const inputTeamURL = findDOMNode(this.refs.inputTeamURL);
    inputTeamURL.addEventListener('invalid', setErrorMessage);
  },

  render() {
    var existingTeam = false;
    if (this.state.name !== '' && this.state.url !== '') {
      existingTeam = true;
    }

    var btnAddText;
    if (existingTeam) {
      btnAddText = 'Save';
    } else {
      btnAddText = 'Add';
    }

    return (
      <ListGroupItem>
        <form
          className='form-inline'
          onSubmit={this.handleSubmit}
        >
          <div className='form-group'>
            <label htmlFor='inputTeamName'>{'Name'}</label>
            { ' ' }
            <input
              type='text'
              required={true}
              className='form-control'
              id='inputTeamName'
              ref='inputTeamName'
              placeholder='Example team'
              value={this.state.name}
              onChange={this.handleNameChange}
            />
          </div>
          { ' ' }
          <div className='form-group'>
            <label htmlFor='inputTeamURL'>{'URL'}</label>
            { ' ' }
            <input
              type='url'
              required={true}
              className='form-control'
              id='inputTeamURL'
              ref='inputTeamURL'
              placeholder='https://example.com/team'
              value={this.state.url}
              onChange={this.handleURLChange}
            />
          </div>
          { ' ' }
          <Button type='submit'>
            { btnAddText }
          </Button>
        </form>
        { (() => {
          if (this.state.errorMessage !== null) {
            return (
              <HelpBlock style={{color: '#777777'}}>
                { this.state.errorMessage }
              </HelpBlock>);
          }
          return null;
        })() }
      </ListGroupItem>
    );
  }
});

module.exports = TeamListItemNew;
