// imports
import { CSSProperties, useContext, useMemo, useRef, useState } from 'react';
import FuzzySearch from 'fuzzy-search';
import classNames from 'classnames';

import './fieldsKeeper.less';
import {
    IFieldsKeeperItem,
    IFieldsKeeperRootBucketProps,
    IGetPriorityTargetBucketToFillProps,
} from './FieldsKeeper.types';
import { assignFieldItems, sortBucketItemsBasedOnGroupOrder } from '..';
import {
    FieldsKeeperContext,
    useStore,
    useStoreState,
} from './FieldsKeeper.context';
import { FieldsKeeperSearcher } from './FieldsKeeperSearcher';

export interface IGroupedFieldsKeeperItem {
    group: string;
    groupLabel: string;
    items: IFieldsKeeperItem[];
}

export interface IGroupedItemRenderer {
    fieldItems: IFieldsKeeperItem[];
    isGroupItem?: boolean;

    groupHeader?: {
        groupItems: IFieldsKeeperItem[];
        isGroupCollapsed: boolean;
        onGroupHeaderToggle: () => void;
        isGroupHeaderSelected?: boolean;
    };
}

// eslint-disable-next-line react-refresh/only-export-components
export const getGroupedItems = (
    currentItems: IFieldsKeeperItem[],
): IGroupedFieldsKeeperItem[] => {
    const groupedItems = currentItems.reduce<IGroupedFieldsKeeperItem[]>(
        (acc, item, fieldItemIndex) => {
            const foundGroup = acc.find((group) => group.group === item.group);
            if (foundGroup) {
                foundGroup.items.push({ ...item, fieldItemIndex });
            } else {
                acc.push({
                    group: item.group ?? 'NO_GROUP',
                    groupLabel: item.groupLabel ?? 'NO_GROUP',
                    items: [{ ...item, fieldItemIndex }],
                });
            }
            return acc;
        },
        [],
    );

    groupedItems.forEach((groupedItem) => {
        groupedItem.items = sortBucketItemsBasedOnGroupOrder(groupedItem.items);
    });

    return groupedItems;
};

export const FieldsKeeperRootBucket = (props: IFieldsKeeperRootBucketProps) => {
    // props
    const {
        label,
        isDisabled,
        labelClassName,
        sortGroupOrderWiseOnAssignment = true,
        instanceId: instanceIdFromProps,
        searchPlaceholder = 'Search',
        wrapperClassName,
        customSearchQuery = undefined,
        onClearSearch,
        showClearSearchLink = true,
        emptyFilterMessage = undefined,
        disabledEmptyFilterMessage = false,
    } = props;

    // refs
    const searchInputRef = useRef<HTMLInputElement>(null);

    // state
    const { instanceId: instanceIdFromContext } =
        useContext(FieldsKeeperContext);
    const instanceId = instanceIdFromProps ?? instanceIdFromContext;
    const { allItems } = useStoreState(instanceId);
    const [searchQuery, setSearchQuery] = useState('');

    // compute
    const hasCustomSearchQuery = customSearchQuery !== undefined;
    const filteredGroupedItems = useMemo<IGroupedFieldsKeeperItem[]>(() => {
        const searcher = new FuzzySearch(allItems, ['label', 'id'], {
            sort: true,
        });
        const currentItems = searcher.search(customSearchQuery ?? searchQuery);
        // group items
        return getGroupedItems(currentItems);
    }, [customSearchQuery, searchQuery, allItems]);

    // actions
    const onClearSearchQuery = () => {
        setSearchQuery('');
        searchInputRef.current?.focus();
        onClearSearch?.();
    };

    // paint
    return (
        <div
            className={classNames(
                'react-fields-keeper-mapping-container',
                {
                    'react-fields-keeper-mapping-content-disabled': isDisabled,
                },
                wrapperClassName,
            )}
        >
            {label ? (
                <div
                    className={classNames(
                        'react-fields-keeper-mapping-subtitle',
                        labelClassName,
                    )}
                >
                    {label}
                </div>
            ) : (
                // to maintain grid consistency
                <div />
            )}
            {!hasCustomSearchQuery ? (
                <FieldsKeeperSearcher
                    ref={searchInputRef}
                    searchPlaceholder={searchPlaceholder}
                    searchQuery={searchQuery}
                    onSearchQueryChange={setSearchQuery}
                />
            ) : (
                <div />
            )}
            <div
                className={classNames(
                    'react-fields-keeper-mapping-content-scrollable-container',
                    'react-fields-keeper-mapping-content-scrollable-container-columns',
                )}
            >
                {filteredGroupedItems.length > 0
                    ? filteredGroupedItems.map((filteredGroupedItem, index) => (
                          <RootBucketGroupedItemRenderer
                              {...props}
                              key={index}
                              filteredGroupedItem={filteredGroupedItem}
                              sortGroupOrderWiseOnAssignment={
                                  sortGroupOrderWiseOnAssignment
                              }
                          />
                      ))
                    : !disabledEmptyFilterMessage && (
                          <div className="react-fields-keeper-mapping-no-search-items-found">
                              {emptyFilterMessage ?? (
                                  <>
                                      <div>
                                          No items found for <br />
                                          <br />
                                          <code>'{searchQuery}'</code>
                                      </div>
                                      <br />
                                      {showClearSearchLink &&
                                          allItems.length > 0 && (
                                              <div
                                                  className="react-fields-keeper-mapping-clear-search-link"
                                                  onClick={onClearSearchQuery}
                                                  role="button"
                                              >
                                                  Clear search
                                              </div>
                                          )}
                                  </>
                              )}
                          </div>
                      )}
            </div>
        </div>
    );
};

const RootBucketGroupedItemRenderer = (
    props: {
        filteredGroupedItem: IGroupedFieldsKeeperItem;
        sortGroupOrderWiseOnAssignment: boolean;
    } & IFieldsKeeperRootBucketProps,
) => {
    // props
    const {
        filteredGroupedItem: { group, groupLabel, items: filteredItems },
        sortGroupOrderWiseOnAssignment,
        getPriorityTargetBucketToFill: getPriorityTargetBucketToFillFromProps,
        instanceId: instanceIdFromProps,
        ignoreCheckBox = false,
        allowDragAfterAssignment = true,
    } = props;

    // state
    const { instanceId: instanceIdFromContext } =
        useContext(FieldsKeeperContext);
    const instanceId = instanceIdFromProps ?? instanceIdFromContext;
    const {
        buckets,
        getPriorityTargetBucketToFill: getPriorityTargetBucketToFillFromContext,
        allowDuplicates,
    } = useStoreState(instanceId);
    const updateState = useStore((state) => state.setState);
    const [isGroupCollapsed, setIsGroupCollapsed] = useState(false);

    // compute
    const hasGroup = group !== 'NO_GROUP';

    // event handlers
    const onDragStartHandler =
        (...fieldItems: IFieldsKeeperItem[]) =>
        (e: React.DragEvent<HTMLDivElement>) => {
            e.dataTransfer.setData(
                instanceId,
                fieldItems.map((item) => item.id).join(','),
            );
        };

    // handlers
    const checkIsFieldItemAssigned = (fieldItem: IFieldsKeeperItem) => {
        return buckets.some((bucket) =>
            bucket.items.some((item) => item.id === fieldItem.id),
        );
    };

    const customTargetBucketIdentifier =
        getPriorityTargetBucketToFillFromProps ??
        getPriorityTargetBucketToFillFromContext;
    const getPriorityTargetBucketToFill = ({
        buckets,
        currentFillingItem,
        priorityGroup,
    }: IGetPriorityTargetBucketToFillProps) => {
        if (customTargetBucketIdentifier) {
            const response = customTargetBucketIdentifier({
                buckets,
                priorityGroup,
                currentFillingItem,
            });
            if (response) return response;
        }

        if (priorityGroup) {
            const priorityGroupBucket = buckets.find((bucket) => {
                return bucket.items.some(
                    (item) => item.group === priorityGroup,
                );
            });
            if (priorityGroupBucket) return priorityGroupBucket;
        }
        const leastFilledOrderedBuckets = [...buckets].sort(
            (bucketA, bucketB) => bucketA.items.length - bucketB.items.length,
        );
        return leastFilledOrderedBuckets[0];
    };

    const onFieldItemClick =
        (fieldItems: IFieldsKeeperItem[], remove = false) =>
        () => {
            const bucketToFill = getPriorityTargetBucketToFill({
                buckets,
                priorityGroup: fieldItems[0].group,
                currentFillingItem: filteredItems,
            });
            assignFieldItems({
                instanceId,
                bucketId: bucketToFill.id,
                fromBucket: 'root_bucket',
                fieldItems,
                buckets,
                removeOnly: remove,
                sortGroupOrderWiseOnAssignment,
                allowDuplicates,
                updateState,
            });
        };

    // paint
    const renderFieldItems = ({
        fieldItems,
        isGroupItem,
        groupHeader,
    }: IGroupedItemRenderer) => {
        // compute
        const isGroupHeader = groupHeader !== undefined;

        // styles
        const itemStyle = (
            isGroupHeader
                ? {
                      '--root-bucket-group-items-count':
                          groupHeader.groupItems.length + 1,
                  }
                : {}
        ) as CSSProperties;

        // paint
        return fieldItems.map((fieldItem) => {
            const isFieldItemAssigned = isGroupHeader
                ? groupHeader?.isGroupHeaderSelected
                : checkIsFieldItemAssigned(fieldItem);
            return (
                <div
                    key={fieldItem.id}
                    className={classNames(
                        'react-fields-keeper-tooltip-wrapper',
                        {
                            'react-fields-keeper-tooltip-disabled-pointer':
                                fieldItem.rootDisabled?.active,
                        },
                    )}
                    title={
                        (fieldItem.rootDisabled?.active
                            ? fieldItem.rootDisabled?.message
                            : fieldItem.rootTooltip) ?? fieldItem.rootTooltip
                    }
                >
                    <div
                        className={classNames(
                            'react-fields-keeper-mapping-column-content',
                            fieldItem.rootBucketActiveNodeClassName,
                            {
                                'react-fields-keeper-mapping-column-content-offset':
                                    isGroupItem,
                                'react-fields-keeper-mapping-column-content-group-header':
                                    isGroupHeader &&
                                    !groupHeader.isGroupCollapsed,
                                'react-fields-keeper-mapping-column-content-disabled':
                                    fieldItem.rootDisabled?.active,
                                'react-fields-keeper-mapping-column-content-without-checkbox':
                                    ignoreCheckBox,
                            },
                        )}
                        style={itemStyle}
                        draggable={
                            allowDragAfterAssignment
                                ? true
                                : !isFieldItemAssigned
                        }
                        onDragStart={onDragStartHandler(
                            ...(isGroupHeader
                                ? groupHeader.groupItems
                                : [fieldItem]),
                        )}
                    >
                        {!ignoreCheckBox && (
                            <div className="react-fields-keeper-mapping-column-content-checkbox">
                                <input
                                    type="checkbox"
                                    checked={isFieldItemAssigned}
                                    onChange={onFieldItemClick(
                                        isGroupHeader
                                            ? groupHeader.groupItems
                                            : [fieldItem],
                                        isFieldItemAssigned,
                                    )}
                                />
                            </div>
                        )}
                        <div className="react-fields-keeper-mapping-column-content-wrapper">
                            <div className="react-fields-keeper-mapping-column-content-label">
                                {fieldItem.label}
                            </div>
                            {isGroupHeader && (
                                <div
                                    className={classNames(
                                        'react-fields-keeper-mapping-column-content-action',
                                    )}
                                    role="button"
                                    onClick={groupHeader.onGroupHeaderToggle}
                                >
                                    {groupHeader.isGroupCollapsed ? (
                                        <i className="fk-ms-Icon fk-ms-Icon--ChevronRight" />
                                    ) : (
                                        <i className="fk-ms-Icon fk-ms-Icon--ChevronDown" />
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            );
        });
    };

    if (hasGroup) {
        let rootDisabled = filteredItems.find(
            (item) => item.rootDisabled?.active,
        )?.rootDisabled;

        const shouldDisabledGroupLabel =
            filteredItems.length > 1
                ? rootDisabled?.disableGroupLabel ?? true
                : true;

        if (rootDisabled) {
            rootDisabled = {
                ...rootDisabled,
                active: shouldDisabledGroupLabel,
            };
        }

        return (
            <>
                {renderFieldItems({
                    fieldItems: [
                        {
                            label: groupLabel,
                            id: group,
                            group,
                            groupLabel,
                            rootDisabled,
                        },
                    ],
                    groupHeader: {
                        isGroupHeaderSelected: filteredItems.some(
                            (item) =>
                                item.rootDisabled?.active !== true &&
                                checkIsFieldItemAssigned(item),
                        ),
                        groupItems: filteredItems,
                        isGroupCollapsed,
                        onGroupHeaderToggle: () =>
                            setIsGroupCollapsed(!isGroupCollapsed),
                    },
                })}
                {!isGroupCollapsed &&
                    renderFieldItems({
                        fieldItems: filteredItems,
                        isGroupItem: true,
                    })}
            </>
        );
    }
    return <>{renderFieldItems({ fieldItems: filteredItems })}</>;
};
