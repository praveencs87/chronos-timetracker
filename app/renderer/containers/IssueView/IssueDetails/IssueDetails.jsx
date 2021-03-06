// @flow
import React from 'react';
import {
  connect,
} from 'react-redux';
import {
  shell,
} from 'electron';
import moment from 'moment';

import type {
  StatelessFunctionalComponent,
  Node,
} from 'react';
import type {
  Connector,
} from 'react-redux';
import type {
  Issue,
} from 'types';

import {
  getBaseUrl,
  getSelectedIssue,
  getSelectedIssueEpic,
} from 'selectors';
import {
  issuesActions,
} from 'actions';
import {
  Flex,
} from 'components';
import {
  getStatusColor,
  getEpicColor,
} from 'utils/jiraColors-util';
import {
  openURLInBrowser,
} from 'utils/external-open-util';

import DescriptionSectionAttachment from 'components/DescriptionSectionAttachment';
import DataRenderer from '../DataRenderer';

import * as S from './styled';

type Props = {
  issue: Issue,
  dispatch: any,
  baseUrl: string,
  epic: Issue & {
    color: string,
    name: string,
  },
};

const IssueDetails: StatelessFunctionalComponent<Props> = ({
  issue,
  epic,
  baseUrl,
  dispatch,
}: Props): Node => {
  const {
    versions,
    fixVersions,
    issuetype,
    priority,
    components,
    status,
    labels,
    reporter,
    assignee,
    resolution,
    created,
    updated,
  } = issue.fields;
  return (
    <S.IssueDetailsContainer>
      <Flex row spaceBetween>
        <S.DetailsColumn>
          <Flex row spaceBetween>
            <S.DetailsLabel>
              Type:
            </S.DetailsLabel>
            <S.DetailsValue>
              {issuetype
                ? (
                  <div>
                    <S.IssueType
                      src={issuetype.iconUrl}
                      alt={issuetype.name}
                    />
                    {issuetype.name}
                  </div>
                )
                : 'None'
              }
            </S.DetailsValue>
          </Flex>

          <Flex row spaceBetween>
            <S.DetailsLabel>
              Priority:
            </S.DetailsLabel>
            <S.DetailsValue>
              {priority
                ? (
                  <div>
                    <S.IssuePriority
                      src={priority.iconUrl}
                      alt={priority.name}
                    />
                    {priority.name}
                  </div>
                )
                : 'None'
              }
            </S.DetailsValue>
          </Flex>

          <Flex row spaceBetween>
            <S.DetailsLabel>
              Affects Version/s:
            </S.DetailsLabel>
            <S.DetailsValue>
              {versions
                ? (
                  <div>
                    {versions.length === 0 && 'None'}
                    {versions.map(v => <a href="#version" key={v.id}>{v.name}</a>)}
                  </div>
                )
                : 'None'
              }
            </S.DetailsValue>
          </Flex>

          <Flex row spaceBetween>
            <S.DetailsLabel>
              Component/s:
            </S.DetailsLabel>
            <S.DetailsValue>
              {components
                ? (
                  <div>
                    {components.length === 0 && 'None'}
                    {components.map(v => <a href="#component" key={v.id}>{v.name}</a>)}
                  </div>
                )
                : 'None'
              }
            </S.DetailsValue>
          </Flex>

          <Flex row spaceBetween>
            <S.DetailsLabel>
              Labels/s:
            </S.DetailsLabel>
            {labels
              ? (
                <S.LabelsWrapper>
                  {labels.length === 0
                  && (
                  <S.DetailsValue>
                    None
                  </S.DetailsValue>
                  )
                }
                  {labels.map(v => (
                    <S.Label
                      key={v}
                    >
                      <S.LabelText>{v}</S.LabelText>
                    </S.Label>
                  ))}
                </S.LabelsWrapper>
              )
              : 'None'
            }
          </Flex>

          <Flex row spaceBetween>
            <S.DetailsLabel>
              Created:
            </S.DetailsLabel>
            <S.DetailsValue>
              {created
                ? moment(created).format('DD, MMMM YYYY')
                : 'None'
              }
            </S.DetailsValue>
          </Flex>

          <Flex row spaceBetween>
            <S.DetailsLabel>
              Updated:
            </S.DetailsLabel>
            <S.DetailsValue>
              {updated
                ? moment(updated).format('DD, MMMM YYYY')
                : 'None'
              }
            </S.DetailsValue>
          </Flex>

        </S.DetailsColumn>
        <S.DetailsColumn>

          <Flex row spaceBetween>
            <S.DetailsLabel>
              Status:
            </S.DetailsLabel>
            {status
              ? (
                <S.DetailsValue style={{ maxWidth: 'calc(100% - 50px)' }}>
                  <S.IssueLabel
                    backgroundColor={getStatusColor(status.statusCategory.colorName)}
                  >
                    {status.name.toUpperCase()}
                  </S.IssueLabel>
                </S.DetailsValue>
              )
              : 'None'
            }
          </Flex>

          <Flex row spaceBetween>
            <S.DetailsLabel>
              Resolution:
            </S.DetailsLabel>
            {resolution
              ? (
                <div>
                  <S.DetailsValue>
                    {resolution === null
                      ? 'Unresolved'
                      : resolution.name
                  }
                  </S.DetailsValue>
                </div>
              )
              : 'None'
            }
          </Flex>

          <Flex row spaceBetween>
            <S.DetailsLabel>
              Fix Version/s:
            </S.DetailsLabel>
            {fixVersions
              ? (
                <div>
                  <S.DetailsValue>
                    {fixVersions.length === 0 && 'None'}
                    {fixVersions.map(v => <a href="#version" key={v.id}>{v.name}</a>)}
                  </S.DetailsValue>
                </div>
              )
              : 'None'
            }
          </Flex>

          <Flex row spaceBetween>
            <S.DetailsLabel>
              Epic link:
            </S.DetailsLabel>
            <S.DetailsValue>
              {epic
                ? (
                  <S.IssueLabel
                    backgroundColor={getEpicColor(epic.color)}
                    onClick={openURLInBrowser(`${baseUrl}/browse/${epic.key}`)}
                  >
                    {epic.name}
                  </S.IssueLabel>
                )
                : 'None'
              }
            </S.DetailsValue>
          </Flex>

          <Flex row spaceBetween>
            <S.DetailsLabel>
              Reporter:
            </S.DetailsLabel>
            <S.DetailsValue>
              {reporter
                ? reporter.displayName
                : 'None'
              }
            </S.DetailsValue>
          </Flex>

          <Flex row spaceBetween>
            <S.DetailsLabel>
              Assignee:
            </S.DetailsLabel>
            <S.DetailsValue>
              {assignee
                ? assignee?.displayName
                : 'None'
              }
            </S.DetailsValue>
          </Flex>

        </S.DetailsColumn>
      </Flex>

      <S.DescriptionSectionHeader>
        <strong>
          Description
        </strong>
        <DataRenderer
          html={issue.renderedFields ? issue.renderedFields.description : null}
          source={issue.fields.description || '*No description*'}
          onAttachmentClick={(e) => {
            const tag = e.target ? e.target.tagName.toLowerCase() : null;
            if (tag && (tag === 'img' || tag === 'a')) {
              e.preventDefault();
              if (tag === 'img') {
                const imgName = e.target.getAttribute('data-attachment-name');
                const attachments = issue.fields.attachment;
                const activeIndex = attachments.findIndex(item => item.filename === imgName);
                dispatch(issuesActions.showAttachmentWindow(
                  {
                    issueId: issue.id,
                    activeIndex,
                  },
                ));
              } else {
                // external links only
                const url = e.target.getAttribute(tag === 'a' ? 'href' : 'src');
                if (url && url.includes('http')) {
                  shell.openExternal(url);
                }
              }
            }
          }}
        />
        {issue?.renderedFields?.attachment && (
          <DescriptionSectionAttachment
            showAttachmentWindow={index => dispatch(
              issuesActions.showAttachmentWindow({
                issueId: issue.id,
                activeIndex: index,
              }),
            )}
            attachment={issue.renderedFields.attachment}
          />
        )}
      </S.DescriptionSectionHeader>
    </S.IssueDetailsContainer>
  );
};

function mapStateToProps(state) {
  return {
    issue: getSelectedIssue(state),
    epic: getSelectedIssueEpic(state),
    baseUrl: getBaseUrl(state),
  };
}

const connector: Connector<{}, Props> = connect(
  mapStateToProps,
  dispatch => ({ dispatch }),
);

export default connector(IssueDetails);
