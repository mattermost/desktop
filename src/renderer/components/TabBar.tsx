// Copyright (c) 2015-2016 Yuya Ochiai
// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Nav, NavItem, NavLink} from 'react-bootstrap';
import {DragDropContext, Draggable, DraggingStyle, Droppable, DropResult, NotDraggingStyle} from 'react-beautiful-dnd';
import classNames from 'classnames';

import {Tab} from 'types/config';

import {getTabDisplayName, getTabViewName, TabType, canCloseTab} from 'common/tabs/TabView';

type Props = {
    activeTabName?: string;
    activeServerName?: string;
    id: string;
    isDarkMode: boolean;
    onSelect: (name: string, index: number) => void;
    onCloseTab: (name: string) => void;
    tabs: Tab[];
    sessionsExpired: Record<string, boolean>;
    unreadCounts: Record<string, number>;
    mentionCounts: Record<string, number>;
    onDrop: (result: DropResult) => void;
    tabsDisabled?: boolean;
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

export default class TabBar extends React.PureComponent<Props> {
    onCloseTab = (name: string) => {
        return (event: React.MouseEvent<HTMLButtonElement>) => {
            event.stopPropagation();
            this.props.onCloseTab(name);
        };
    }

    render() {
        const orderedTabs = this.props.tabs.concat().sort((a, b) => a.order - b.order);
        const tabs = orderedTabs.map((tab, orderedIndex) => {
            const index = this.props.tabs.indexOf(tab);
            const tabName = getTabViewName(this.props.activeServerName!, tab.name);

            const sessionExpired = this.props.sessionsExpired[tabName];
            const hasUnreads = this.props.unreadCounts[tabName];

            let mentionCount = 0;
            if (this.props.mentionCounts[tabName] > 0) {
                mentionCount = this.props.mentionCounts[tabName];
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
                    key={index}
                    draggableId={`teamTabItem${index}`}
                    index={orderedIndex}
                >
                    {(provided, snapshot) => {
                        if (tab.isClosed) {
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
                                id={`teamTabItem${index}`}
                                draggable={false}
                                title={getTabDisplayName(tab.name as TabType)}
                                className={classNames('teamTabItem', {
                                    active: this.props.activeTabName === tab.name,
                                    dragging: snapshot.isDragging,
                                })}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                style={getStyle(provided.draggableProps.style)}
                            >
                                <NavLink
                                    eventKey={index}
                                    draggable={false}
                                    active={this.props.activeTabName === tab.name}
                                    disabled={this.props.tabsDisabled}
                                    onSelect={() => {
                                        this.props.onSelect(tab.name, index);
                                    }}
                                >
                                    <div className='TabBar-tabSeperator'>
                                        <span>
                                            {getTabDisplayName(tab.name as TabType)}
                                        </span>
                                        { badgeDiv }
                                        {canCloseTab(tab.name as TabType) &&
                                            <button
                                                className='teamTabItem__close'
                                                onClick={this.onCloseTab(tab.name)}
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
                            className={`TabBar${this.props.isDarkMode ? ' darkMode' : ''}`}
                            id={this.props.id}
                            variant='tabs'
                            {...provided.droppableProps}
                        >
                            {tabs}
                            {provided.placeholder}
                        </Nav>
                    )}
                </Droppable>
            </DragDropContext>
        );
    }
}
