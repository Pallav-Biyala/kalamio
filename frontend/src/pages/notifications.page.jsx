import api from "../common/api";
import usePageTitle from "../common/usePageTitle";
import { useContext, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { UserContext } from "../App";
import { filterPaginationData } from "../common/filter-pagination-data";
import Loader from "../components/loader.component";
import AnimationWrapper from "../common/page-animation";
import NoDataMessage from "../components/nodata.component";
import NotificationCard from "../components/notification-card.component";
import LoadMoreDataBtn from "../components/load-more.component";
import Icon from "../components/Icon";
import toast from "react-hot-toast";

const Notifications = () => {

    usePageTitle('Notifications');

    let { userAuth, userAuth: { access_token, new_notification_avilable }, setUserAuth } = useContext(UserContext);

    const [ filter, setFilter ] = useState('all');
    const [ notifications, setNotifications ] = useState(null);

    let filters = ['all', 'like', 'comment', 'reply', 'follow', 'connect_request', 'subscribe', 'mention'];

    const fetchNotifications = ({ page, deletedDocCount=0 }) => {
        
        api.post("/notifications", { page, filter, deletedDocCount })
        .then(async ({ data: { notifications: data } }) => {

            if(new_notification_avilable){
                setUserAuth({ ...userAuth, new_notification_avilable: false })
            }

            let formatedData = await filterPaginationData({
                state: notifications,
                data, page,
                countRoute: "/all-notifications-count",
                data_to_send: { filter },
                user: access_token
            })

            setNotifications(formatedData)

        })
        .catch(err => {
        })

    }

    useEffect(() => {

        if(access_token){
            fetchNotifications({ page: 1 });
        }

    }, [access_token, filter])

    const handleFilter = (e) => {
        let btn = e.target;
        setFilter(btn.innerHTML);

        setNotifications(null);
    }

    const handleMarkAllRead = () => {
        api.post("/mark-all-notifications-read")
        .then(({ data }) => {
            if (data.modified_count > 0) {
                toast.success(`Marked ${data.modified_count} notifications as read`);
                // Update local state — set all notifications as seen
                setNotifications(prev => {
                    if (!prev) return prev;
                    return {
                        ...prev,
                        results: prev.results.map(n => ({ ...n, seen: true }))
                    };
                });
                setUserAuth({ ...userAuth, new_notification_avilable: false });
            } else {
                toast.success("All caught up!");
            }
        })
        .catch(() => {
            toast.error("Failed to mark notifications as read");
        });
    };

    const handleDeleteNotification = (notificationId) => {
        api.post("/delete-notification", { _id: notificationId })
        .then(() => {
            setNotifications(prev => {
                if (!prev) return prev;
                const newResults = prev.results.filter(n => n._id !== notificationId);
                return {
                    ...prev,
                    results: newResults,
                    totalDocs: prev.totalDocs - 1
                };
            });
        })
        .catch(() => {
            toast.error("Failed to delete notification");
        });
    };

    return(
        <div>

            <div className="flex items-center justify-between max-md:mt-2 mb-2">
                <h1 className="max-md:hidden">Recent Notifications</h1>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleMarkAllRead}
                        className="btn-light text-sm py-2 px-4 flex items-center gap-1.5"
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
                notifications == null ? <Loader /> : 
                <>
                    {
                        notifications.results.length ? 
                            notifications.results.map((notification, i) => {
                                return <AnimationWrapper key={notification._id || i} transition={{ delay: i*0.08 }}>
                                    <NotificationCard
                                        data={notification}
                                        index={i}
                                        notificationState={{ notifications, setNotifications }}
                                        onDelete={handleDeleteNotification}
                                    />
                                </AnimationWrapper>
                            })
                        : <NoDataMessage message="Nothing available" />
                    }

                    <LoadMoreDataBtn state={notifications} fetchDataFun={fetchNotifications} additionalParam={{ deletedDocCount: notifications.deletedDocCount }} />
                </>
            }

        </div>
    )
}

export default Notifications;