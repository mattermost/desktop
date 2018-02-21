const React = require('react');
const PropTypes = require('prop-types');
const {Alert} = require('react-bootstrap');

const baseClassName = 'AutoSaveIndicator';
const leaveClassName = `${baseClassName}-Leave`;

const SAVING_STATE_SAVING = 'saving';
const SAVING_STATE_SAVED = 'saved';
const SAVING_STATE_ERROR = 'error';
const SAVING_STATE_DONE = 'done';

function getClassNameAndMessage(savingState, errorMessage) {
  switch (savingState) {
  case SAVING_STATE_SAVING:
    return {className: baseClassName, message: 'Saving...'};
  case SAVING_STATE_SAVED:
    return {className: baseClassName, message: 'Saved'};
  case SAVING_STATE_ERROR:
    return {className: `${baseClassName}`, message: errorMessage};
  case SAVING_STATE_DONE:
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
  errorMessage: PropTypes.string,
};

Object.assign(AutoSaveIndicator, {
  SAVING_STATE_SAVING,
  SAVING_STATE_SAVED,
  SAVING_STATE_ERROR,
  SAVING_STATE_DONE,
});

module.exports = AutoSaveIndicator;
