const React = require('react');
const PropTypes = require('prop-types');
const {Modal} = require('react-bootstrap');

const DestructiveConfirmationModal = require('./DestructiveConfirmModal.jsx');

function RemoveServerModal(props) {
  const {serverName, ...rest} = props;
  return (
    <DestructiveConfirmationModal
      {...rest}
      title='Remove Server'
      acceptLabel='Remove'
      cancelLabel='Cancel'
      body={(
        <Modal.Body>
          <p>
            {'This will remove the server from your Desktop App but will not delete any of its data' +
          ' - you can add the server back to the app at any time.'}
          </p>
          <p>
            {'Confirm you wish to remove the '}<strong>{serverName}</strong>{' server?'}
          </p>
        </Modal.Body>
      )}
    />
  );
}

RemoveServerModal.propTypes = {
  serverName: PropTypes.string.isRequired,
};

module.exports = RemoveServerModal;
