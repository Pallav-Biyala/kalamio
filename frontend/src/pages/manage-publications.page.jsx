import api from "../common/api";
import usePageTitle from "../common/usePageTitle";
import { useContext, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { UserContext } from "../App";
import Loader from "../components/loader.component";
import AnimationWrapper from "../common/page-animation";
import NoDataMessage from "../components/nodata.component";
import Icon from "../components/Icon";
import toast from "react-hot-toast";

const ManagePublicationsPage = () => {

    usePageTitle('Publications');

    let { userAuth: { access_token } } = useContext(UserContext);

    const [publications, setPublications] = useState(null);

    const fetchPublications = () => {
        api.post("/my-publications")
        .then(({ data }) => setPublications(data.publications))
        .catch(() => setPublications([]));
    };

    useEffect(() => {
        if (access_token) {
            fetchPublications();
        }
    }, [access_token]);

    const handleDelete = async (pubId, title) => {
        if (!window.confirm(`Delete "${title}"? This will unlink all blogs and remove all subscribers.`)) return;

        try {
            await api.post("/publication/delete", { publication_id: pubId });
            toast.success("Publication deleted");
            setPublications(publications.filter(p => p._id !== pubId));
        } catch (err) {
            toast.error("Failed to delete publication");
        }
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-8">
                <h1 className="max-md:hidden">Publications</h1>
                <Link to="/dashboard/create-publication" className="pub-create-btn">
                    <Icon name="add" className="text-lg" />
                    New Publication
                </Link>
            </div>

            {publications == null ? <Loader /> :
                publications.length ?
                    publications.map((pub, i) => (
                        <AnimationWrapper key={pub._id} transition={{ delay: i * 0.06 }}>
                            <div className="pub-manage-card">
                                <div className="pub-manage-card__info">
                                    <Link to={`/publication/${pub.slug}`} className="pub-manage-card__title">
                                        {pub.title}
                                    </Link>
                                    {pub.description && (
                                        <p className="pub-manage-card__desc">{pub.description}</p>
                                    )}
                                    <div className="pub-manage-card__stats">
                                        <span>
                                            <Icon name="group" className="text-sm" /> {pub.total_subscribers} subscribers
                                        </span>
                                        <span>
                                            <Icon name="article" className="text-sm" /> {pub.total_posts} posts
                                        </span>
                                    </div>
                                </div>
                                <div className="pub-manage-card__actions">
                                    <Link to={`/publication/${pub.slug}`} className="pub-manage-card__btn" title="View">
                                        <Icon name="visibility" />
                                    </Link>
                                    <button
                                        onClick={() => handleDelete(pub._id, pub.title)}
                                        className="pub-manage-card__btn pub-manage-card__btn--danger"
                                        title="Delete"
                                    >
                                        <Icon name="delete" />
                                    </button>
                                </div>
                            </div>
                        </AnimationWrapper>
                    ))
                : <NoDataMessage message="No publications yet. Create your first one!" />
            }
        </div>
    );
};

export default ManagePublicationsPage;
