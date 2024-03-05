// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import type {DraggingStyle, DropResult, NotDraggingStyle} from 'react-beautiful-dnd';
import {DragDropContext, Draggable, Droppable} from 'react-beautiful-dnd';
import {Nav, NavItem, NavLink} from 'react-bootstrap';
import type {IntlShape} from 'react-intl';
import {FormattedMessage, injectIntl} from 'react-intl';

import type {ViewType} from 'common/views/View';
import {canCloseView, getViewDisplayName} from 'common/views/View';

import type {UniqueView} from 'types/config';

type Props = {
    activeTabId?: string;
    activeServerId?: string;
    id: string;
    isDarkMode: boolean;
    onSelect: (id: string) => void;
    onCloseTab: (id: string) => void;
    tabs: UniqueView[];
    sessionsExpired: Record<string, boolean>;
    unreadCounts: Record<string, boolean>;
    mentionCounts: Record<string, number>;
    onDrop: (result: DropResult) => void;
    tabsDisabled?: boolean;
    isMenuOpen?: boolean;
    intl: IntlShape;
};

function getStyle(style?: DraggingStyle | NotDraggingStyle) {
    if (style?.transform) {
        const axisLockX = `${style.transform.slice(0, style.transform.indexOf(','))}, 0px)`;
        return {
            ...style,
            transform: axisLockX,
        };
    }
    return style;
}

class TabBar extends React.PureComponent<Props> {
    onCloseTab = (id: string) => {
        return (event: React.MouseEvent<HTMLButtonElement>) => {
            event.stopPropagation();
            this.props.onCloseTab(id);
        };
    };

    render() {
        const tabs = this.props.tabs.map((tab, index) => {
            const sessionExpired = this.props.sessionsExpired[tab.id!];
            const hasUnreads = this.props.unreadCounts[tab.id!];

            let mentionCount = 0;
            if (this.props.mentionCounts[tab.id!] > 0) {
                mentionCount = this.props.mentionCounts[tab.id!];
            }

            let badgeDiv: React.ReactNode;
            if (sessionExpired) {
                badgeDiv = (
                    <div className='TabBar-expired'>
                        <i className='icon-alert-circle-outline'/>
                    </div>
                );
            } else if (mentionCount !== 0) {
                badgeDiv = (
                    <div className='TabBar-badge'>
                        <span>{mentionCount}</span>
                    </div>
                );
            } else if (hasUnreads) {
                badgeDiv = (
                    <div className='TabBar-dot'/>
                );
            }

            return (
                <Draggable
                    key={tab.id}
                    draggableId={`serverTabItem-${tab.id}`}
                    index={index}
                >
                    {(provided, snapshot) => {
                        if (!tab.isOpen) {
                            return (
                                <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                />
                            );
                        }

                        return (
                            <NavItem
                                ref={provided.innerRef}
                                as='li'
                                id={`serverTabItem${index}`}
                                draggable={false}
                                title={this.props.intl.formatMessage({id: `common.tabs.${tab.name}`, defaultMessage: getViewDisplayName(tab.name as ViewType)})}
                                className={classNames('serverTabItem', {
                                    active: this.props.activeTabId === tab.id,
                                    dragging: snapshot.isDragging,
                                })}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                style={getStyle(provided.draggableProps.style)}
                            >
                                <NavLink
                                    eventKey={index}
                                    draggable={false}
                                    active={this.props.activeTabId === tab.id}
                                    disabled={this.props.tabsDisabled}
                                    onSelect={() => {
                                        this.props.onSelect(tab.id!);
                                    }}
                                >
                                    <div className='TabBar-tabSeperator'>
                                        <FormattedMessage
                                            id={`common.tabs.${tab.name}`}
                                            defaultMessage={getViewDisplayName(tab.name as ViewType)}
                                        />
                                        { badgeDiv }
                                        {canCloseView(tab.name as ViewType) &&
                                            <button
                                                className='serverTabItem__close'
                                                onClick={this.onCloseTab(tab.id!)}
                                            >
                                                <i className='icon-close'/>
                                            </button>
                                        }
                                    </div>
                                </NavLink>
                            </NavItem>
                        );
                    }}
                </Draggable>
            );
        });

        return (
            <DragDropContext onDragEnd={this.props.onDrop}>
                <Droppable
                    isDropDisabled={this.props.tabsDisabled}
                    droppableId='tabBar'
                    direction='horizontal'
                >
                    {(provided) => (
                        <Nav
                            ref={provided.innerRef}
                            className={classNames('TabBar', {
                                darkMode: this.props.isDarkMode,
                            })}
                            id={this.props.id}
                            variant='tabs'
                            {...provided.droppableProps}
                        >
                            {tabs}
                            {this.props.isMenuOpen ? <span className='TabBar-nonDrag'/> : null}
                            {provided.placeholder}
                        </Nav>
                    )}
                </Droppable>
            </DragDropContext>
        );
    }
}

export default injectIntl(TabBar);
