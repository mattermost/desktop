const React = require('react');
const PropTypes = require('prop-types');
const {Button, Modal} = require('react-bootstrap');

function DestructiveConfirmationModal(props) {
  const {
    title,
    body,
    acceptLabel,
    cancelLabel,
    onAccept,
    onCancel,
    ...rest} = props;
  return (
    <Modal {...rest}>
      <Modal.Header closeButton={true}>
        <Modal.Title>{title}</Modal.Title>
      </Modal.Header>
      {body}
      <Modal.Footer>
        <Button
          bsStyle='link'
          onClick={onCancel}
        >{cancelLabel}</Button>
        <Button
          bsStyle='danger'
          onClick={onAccept}
        >{acceptLabel}</Button>
      </Modal.Footer>
    </Modal>
  );
}

DestructiveConfirmationModal.propTypes = {
  title: PropTypes.string.isRequired,
  body: PropTypes.node.isRequired,
  acceptLabel: PropTypes.string.isRequired,
  cancelLabel: PropTypes.string.isRequired,
  onAccept: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};

module.exports = DestructiveConfirmationModal;
