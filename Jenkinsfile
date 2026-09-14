pipeline {
    agent any

    environment {
        // =================================================
        // 프로젝트 / 배포 경로
        // =================================================
        TARGET_DIR      = '/home/totoro/Reactproject/travel-maker'
        APP_NAME        = 'travel-maker'

        FRONTEND_DIR    = "${WORKSPACE}/frontend"

        // Vite build 결과물이 저장될 경로 (vite.config.js 설정과 일치)
        STATIC_OUT_DIR  = "${WORKSPACE}/src/main/resources/static"

        // =================================================
        // 실행 환경
        // =================================================
        JAVA_HOME       = '/usr/lib/jvm/java-21-openjdk-amd64'
        APP_PORT        = '8084'

        PATH            = "/usr/local/bin:/usr/bin:/bin:${env.PATH}"
    }

    tools {
        jdk 'JDK21'
        nodejs 'NodeJS24'
    }

    stages {
        stage('Checkout') {
            steps {
                // Git 저장소 소스 코드 체크아웃
                checkout scm
            }
        }

        stage('Build Frontend') {
            steps {
                dir(env.FRONTEND_DIR) {
                    // 의존성 설치 및 React 빌드
                    sh 'npm install'
                    sh 'npm run build'
                }
            }
        }

        stage('Build Backend') {
            steps {
                // Gradle을 이용한 Spring Boot Executable JAR 빌드 (테스트 제외)
                sh './gradlew clean build -x test'
            }
        }

        stage('Deploy') {
            steps {
                // 1. 기존에 실행 중인 travel-maker 관련 프로세스 안전 종료
                sh "pkill -f '${env.APP_NAME}.*\\.jar' || true"

                // 2. 백그라운드로 Spring Boot 실행 (로그는 app.log로 저장)
                sh "nohup java -jar build/libs/*.jar > ./app.log 2>&1 &"
            }
        }
    }

    post {
        success {
            echo 'Jenkins Build & Deploy Success!'
        }
        failure {
            echo 'Jenkins Build & Deploy Failed.'
        }
    }
}