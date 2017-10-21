const React = require('react');
const PropTypes = require('prop-types');
const {Alert} = require('react-bootstrap');

const baseClassName = 'AutoSaveIndicator';
const leaveClassName = `${baseClassName}-Leave`;

function getClassNameAndMessage(savingState, errorMessage) {
  switch (savingState) {
  case 'saving':
    return {className: baseClassName, message: 'Saving...'};
  case 'saved':
    return {className: baseClassName, message: 'Saved'};
  case 'error':
    return {className: `${baseClassName}`, message: errorMessage};
  case 'done':
    return {className: `${baseClassName} ${leaveClassName}`, message: 'Saved'};
  default:
    return {className: `${baseClassName} ${leaveClassName}`, message: ''};
  }
}

function AutoSaveIndicator(props) {
  const {savingState, errorMessage, ...rest} = props;
  const {className, message} = getClassNameAndMessage(savingState, errorMessage);

  return (
    <Alert
      className={className}
      {...rest}
      bsStyle={savingState === 'error' ? 'danger' : 'info'}
    >
      {message}
    </Alert>
  );
}

AutoSaveIndicator.propTypes = {
  savingState: PropTypes.string.isRequired,
  errorMessage: PropTypes.string
};

module.exports = AutoSaveIndicator;
