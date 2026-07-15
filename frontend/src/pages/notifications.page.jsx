import usePageTitle from "../common/usePageTitle";
import { useState, useEffect, useContext } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import Loader from "../components/loader.component";
import AnimationWrapper from "../common/page-animation";
import NoDataMessage from "../components/nodata.component";
import NotificationCard from "../components/notification-card.component";
import LoadMoreDataBtn from "../components/load-more.component";
import Icon from "../components/Icon";
import { UserContext } from "../App";
import { queryKeys } from "../common/queryKeys";
import { useNotifications } from "../hooks/queries";
import { useDeleteNotification, useMarkNotificationsRead } from "../hooks/mutations";

const Notifications = () => {

    usePageTitle('Notifications');

    const [ filter, setFilter ] = useState('all');

    let filters = ['all', 'like', 'comment', 'reply', 'follow', 'subscribe', 'mention', 'poll_vote'];

    const { setUserAuth } = useContext(UserContext);
    const queryClient = useQueryClient();

    // TanStack Query hooks
    const notificationsQuery = useNotifications(filter);
    const notifications = notificationsQuery.data?.notifications || [];

    const deleteNotification = useDeleteNotification();
    const markAllRead = useMarkNotificationsRead();

    // Visiting the tab: the server marks notifications seen when the list is fetched, so clear the
    // Activity badge to match — the context flag (mobile) and the unread query (desktop).
    useEffect(() => {
        if (!notificationsQuery.dataUpdatedAt) return;
        setUserAuth(prev => prev.new_notification_available ? { ...prev, new_notification_available: false } : prev);
        queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unread() });
    }, [notificationsQuery.dataUpdatedAt]);

    const handleFilter = (e) => {
        let btn = e.target;
        setFilter(btn.innerHTML);
    }

    const handleMarkAllRead = () => {
        markAllRead.mutate();
    };

    const handleDeleteNotification = (notificationId) => {
        deleteNotification.mutate({ _id: notificationId, filter });
    };

    return(
        <div>

            <div className="flex items-center justify-between max-md:mt-2 mb-2">
                <h1 className="max-md:hidden">Recent Notifications</h1>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleMarkAllRead}
                        className="btn-light text-sm py-2 px-4 flex items-center gap-1.5"
                        disabled={markAllRead.isPending}
                    >
                        <Icon name="done_all" className="text-[18px]" />
                        <span className="hidden sm:inline">Mark All Read</span>
                    </button>
                    <Link
                        to="/settings/notification-preferences"
                        className="btn-light text-sm py-2 px-4 flex items-center gap-1.5"
                        title="Notification Preferences"
                    >
                        <Icon name="settings" className="text-[18px]" />
                    </Link>
                </div>
            </div>

            <div className="my-4 flex gap-3 md:gap-6 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                {
                    filters.map((filterName, i) => {
                        return <button 
                            key={i} 
                            className={"py-2 whitespace-nowrap flex-shrink-0 " + ( filter == filterName ? "btn-dark" : "btn-light")}
                            onClick={handleFilter}
                        >{filterName}</button>
                    })
                }
            </div>

            {
                notificationsQuery.isLoading ? <Loader /> : 
                <>
                    {
                        notifications.length ? 
                            notifications.map((notification, i) => {
                                return <AnimationWrapper key={notification._id || i} transition={{ delay: i*0.08 }}>
                                    <NotificationCard
                                        data={notification}
                                        index={i}
                                        onDelete={handleDeleteNotification}
                                    />
                                </AnimationWrapper>
                            })
                        : <NoDataMessage message="Nothing available" />
                    }

                    <LoadMoreDataBtn
                        fetchNextPage={notificationsQuery.fetchNextPage}
                        hasNextPage={notificationsQuery.hasNextPage}
                        isFetchingNextPage={notificationsQuery.isFetchingNextPage}
                    />
                </>
            }

        </div>
    )
}

export default Notifications;