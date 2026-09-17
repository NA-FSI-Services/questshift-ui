FROM registry.access.redhat.com/ubi9/nginx-124:latest

COPY dist/ /opt/app-root/src/
COPY nginx/nginx.conf /etc/nginx/nginx.conf

EXPOSE 8080
USER 1001
CMD ["nginx", "-g", "daemon off;"]
