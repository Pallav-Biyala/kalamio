import { Link } from "react-router-dom";
import { getFullDay } from "../common/date";
import Icon from "./Icon";
import SocialIcon from "./SocialIcon";

const AboutPublication = ({ className, description, social_links, createdAt, total_reads }) => {
    return(
        <div className={"md:w-[90%] md:mt-7 " + className}>
            <p className="text-xl leading-7">{ description?.length ? description : "Nothing to read here" }</p>

            <div className="flex gap-x-7 gap-y-2 flex-wrap my-7 items-center text-dark-grey">
                {
                    social_links && Object.keys(social_links).map((key) => {

                        let link = social_links[key];

                        if (!link) return null;
                        if (key === '_id' || key === '__v') return null;

                        if (key === 'website') {
                            return (
                                <Link to={link.includes('http') ? link : `https://${link}`} key={key} target="_blank" aria-label="Website">
                                    <Icon name="language" className="text-2xl hover:text-black" />
                                </Link>
                            );
                        }

                        return <SocialIcon key={key} platform={key} url={link} className="!w-6 !h-6" />;
                    })
                }
            </div>

            <div className="flex flex-col gap-2 mt-4 text-dark-grey">
                <p className="text-xl leading-7 flex items-center gap-2">
                    <Icon name="visibility" className="text-2xl" />
                    {total_reads?.toLocaleString() || 0} Article Reads
                </p>
                <p className="text-xl leading-7 flex items-center gap-2">
                    <Icon name="calendar_month" className="text-2xl" />
                    Created on {getFullDay(createdAt)}
                </p>
            </div>

        </div>
    )
}

export default AboutPublication;
