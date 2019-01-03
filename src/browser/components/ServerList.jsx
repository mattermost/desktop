// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import React from 'react';
import PropTypes from 'prop-types';
import {ListGroup} from 'react-bootstrap';

import ServerListItem from './ServerListItem.jsx';
import NewServerModal from './NewServerModal.jsx';
import RemoveServerModal from './RemoveServerModal.jsx';

export default class ServerList extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      showEditServerForm: false,
      indexToRemoveServer: -1,
      server: {
        url: '',
        name: '',
        index: false,
      },
    };

    this.handleServerRemove = this.handleServerRemove.bind(this);
    this.handleServerAdd = this.handleServerAdd.bind(this);
    this.handleServerEditing = this.handleServerEditing.bind(this);
    this.openServerRemoveModal = this.openServerRemoveModal.bind(this);
    this.closeServerRemoveModal = this.closeServerRemoveModal.bind(this);
  }

  handleServerRemove(index) {
    console.log(index);
    const servers = this.props.servers;
    servers.splice(index, 1);
    this.props.onServersChange(servers);
  }

  handleServerAdd(server) {
    const servers = this.props.servers;

    // check if server already exists and then change existing server or add new one
    if ((typeof server.index !== 'undefined') && servers[server.index]) {
      servers[server.index].name = server.name;
      servers[server.index].url = server.url;
    } else {
      servers.push(server);
    }

    this.setState({
      showEditServerForm: false,
      server: {
        url: '',
        name: '',
        index: false,
      },
    });

    this.props.onServersChange(servers);
  }

  handleServerEditing(serverName, serverUrl, serverIndex) {
    this.setState({
      showEditServerForm: true,
      server: {
        url: serverUrl,
        name: serverName,
        index: serverIndex,
      },
    });
  }

  openServerRemoveModal(indexForServer) {
    this.setState({indexToRemoveServer: indexForServer});
  }

  closeServerRemoveModal() {
    this.setState({indexToRemoveServer: -1});
  }

  render() {
    const self = this;
    const serverNodes = this.props.servers.map((server, i) => {
      function handleServerRemove() {
        document.activeElement.blur();
        self.openServerRemoveModal(i);
      }

      function handleServerEditing() {
        document.activeElement.blur();
        self.handleServerEditing(server.name, server.url, i);
      }

      function handleServerClick() {
        self.props.onServerClick(i);
      }

      return (
        <ServerListItem
          index={i}
          key={'serverListItem' + i}
          name={server.name}
          url={server.url}
          onServerRemove={handleServerRemove}
          onServerEditing={handleServerEditing}
          onServerClick={handleServerClick}
        />
      );
    });

    const addServerForm = (
      <NewServerModal
        show={this.props.showAddServerForm || this.state.showEditServerForm}
        editMode={this.state.showEditServerForm}
        onClose={() => {
          this.setState({
            showEditServerForm: false,
            server: {
              name: '',
              url: '',
              index: false,
            },
          });
          this.props.setAddServerFormVisibility(false);
        }}
        onSave={(newServer) => {
          const serverData = {
            name: newServer.name,
            url: newServer.url,
          };
          if (this.props.showAddServerForm) {
            this.props.addServer(serverData);
          } else {
            this.props.updateServer(newServer.index, serverData);
          }
          this.setState({
            showNewServerModal: false,
            showEditServerForm: false,
            server: {
              name: '',
              url: '',
              index: false,
            },
          });
          this.render();
          this.props.setAddServerFormVisibility(false);
        }}
        server={this.state.server}
      />);

    const removeServer = this.props.servers[this.state.indexToRemoveServer];
    const removeServerModal = (
      <RemoveServerModal
        show={this.state.indexToRemoveServer !== -1}
        serverName={removeServer ? removeServer.name : ''}
        onHide={this.closeServerRemoveModal}
        onCancel={this.closeServerRemoveModal}
        onAccept={() => {
          this.handleServerRemove(this.state.indexToRemoveServer);
          this.closeServerRemoveModal();
        }}
      />
    );

    return (
      <ListGroup className='serverList'>
        { serverNodes }
        { addServerForm }
        { removeServerModal}
      </ListGroup>
    );
  }
}

ServerList.propTypes = {
  onServersChange: PropTypes.func,
  showAddServerForm: PropTypes.bool,
  servers: PropTypes.array,
  addServer: PropTypes.func,
  updateServer: PropTypes.func,
  toggleAddServerForm: PropTypes.func,
  setAddServerFormVisibility: PropTypes.func,
  onServerClick: PropTypes.func,
};
