const React = require('react');
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
  title: React.PropTypes.string.isRequired,
  body: React.PropTypes.node.isRequired,
  acceptLabel: React.PropTypes.string.isRequired,
  cancelLabel: React.PropTypes.string.isRequired,
  onAccept: React.PropTypes.func.isRequired,
  onCancel: React.PropTypes.func.isRequired
};

module.exports = DestructiveConfirmationModal;
